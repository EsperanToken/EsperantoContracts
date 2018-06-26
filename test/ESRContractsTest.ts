import { ItTestFn } from '../globals';
import * as BigNumber from 'bignumber.js';
import {
  ICOState,
  IESRTICO,
  TokenReservation
} from '../contracts';
import { assertEvmThrows, assertEvmInvalidOpcode } from './lib/assert';
import { Seconds, web3IncreaseTimeTo } from './lib/time';

const it = (<any>global).it as ItTestFn;
const assert = (<any>global).assert as Chai.AssertStatic;

const ESRToken = artifacts.require('./ESRToken.sol');
const ESRTICO = artifacts.require('./ESRTICO.sol');
const ONE_TOKEN = new BigNumber('1e18');
const BONUS_20_END_AT = 1538352000; // 2018-10-01T00:00:00.000Z
const BONUS_10_END_AT = 1546300800; // 2019-01-01T00:00:00.000Z
let BONUS_05_END_AT = 1554076800; // 2019-04-01T00:00:00.000Z
let END_AT = 1559347200; // 2019-06-01T00:00:00.000Z
const TOKEN_UNLOCK_AT = 1569888000; // 2019-10-01T00:00:00.000Z
const MINT_UNLOCK_AT = 1590969600; // 2020-06-01T00:00:00.000Z
const ETH_TOKEN_EXCHANGE_RATIO_MULTIPLIER = 1000;

function tokens(val: BigNumber.NumberLike): string {
  return new BigNumber(val).times(ONE_TOKEN).toString();
}

function tokens2wei(val: BigNumber.NumberLike, exchangeRatio: BigNumber.NumberLike, bonus: number): string {
  return new BigNumber(val)
    .mul(ONE_TOKEN)
    .mul(100)
    .mul(ETH_TOKEN_EXCHANGE_RATIO_MULTIPLIER)
    .divToInt(exchangeRatio)
    .divToInt(100 + bonus)
    .toString();
}

function wei2rawtokens(val: BigNumber.NumberLike, exchangeRatio: BigNumber.NumberLike, bonus: number): string {
  return new BigNumber(val)
    .mul(exchangeRatio)
    .div(ETH_TOKEN_EXCHANGE_RATIO_MULTIPLIER)
    .mul(100 + bonus)
    .divToInt(100)
    .toString();
}

// ICO Instance
let Ico: IESRTICO | null;

const state = {
  availableTokens: new BigNumber(0),
  ownerTokens: new BigNumber(0),
  teamWalletBalance: new BigNumber(0),
  teamWalletInitialBalance: new BigNumber(0),
  sentWei: new BigNumber(0),
  collectedTokens: new BigNumber(0),
  investor1Wei: new BigNumber(0),
  investor2Wei: new BigNumber(0),
  investor3Wei: new BigNumber(0),
  investor4Wei: new BigNumber(0),
  investor5Wei: new BigNumber(0),
  investor6Wei: new BigNumber(0),
  investor7Wei: new BigNumber(0),
  investor8Wei: new BigNumber(0),
  exchangeEthTokenRatio: new BigNumber(3000 * ETH_TOKEN_EXCHANGE_RATIO_MULTIPLIER)
};

contract('ESRContracts', function (accounts: string[]) {
  let cnt = 0;
  const actors = {
    owner: accounts[cnt++], // token owner
    someone1: accounts[cnt++],
    someone2: accounts[cnt++],
    team1: accounts[cnt++],
    investor1: accounts[cnt++],
    investor2: accounts[cnt++],
    investor3: accounts[cnt++],
    investor4: accounts[cnt++],
    investor5: accounts[cnt++],
    investor6: accounts[cnt++],
    investor7: accounts[cnt++],
    investor8: accounts[cnt++],
    teamWallet: accounts[cnt++],
    reserve1: accounts[cnt++],
    reserve2: accounts[cnt++],
    reserve3: accounts[cnt++]
  } as { [k: string]: string };
  console.log('Actors: ', actors);

  it('should be correct initial token state', async () => {
    const token = await ESRToken.deployed();
    // Total supply
    assert.equal(await token.totalSupply.call(), tokens(120e6));
    // Token locked
    assert.equal(await token.locked.call(), true);
    // Token owner
    assert.equal(await token.owner.call(), actors.owner);
    // Token name
    assert.equal(await token.name.call(), 'EsperantoToken');
    // Token symbol
    assert.equal(await token.symbol.call(), 'ESRT');
    // Token decimals
    assert.equal(await token.decimals.call(), 18);
    // ETH/Token exchange ratio
    assert.equal(await token.ethTokenExchangeRatio.call(), state.exchangeEthTokenRatio.toString());
    assert.equal(await token.ETH_TOKEN_EXCHANGE_RATIO_MULTIPLIER.call(), ETH_TOKEN_EXCHANGE_RATIO_MULTIPLIER);

    state.availableTokens = new BigNumber(await token.availableSupply.call());
    // Team
    assert.equal(new BigNumber(await token.getReservedTokens.call(TokenReservation.Team)).toString(), tokens(12e6));
    // Bounty
    assert.equal(new BigNumber(await token.getReservedTokens.call(TokenReservation.Bounty)).toString(), tokens(30e6));
    // Partners
    assert.equal(new BigNumber(await token.getReservedTokens.call(TokenReservation.Partners)).toString(), tokens(18e6));
    // Available supply
    assert.equal(
      await token.availableSupply.call(),
      new BigNumber(tokens(60e6)).toString()
    );
  });

  it('should be locked until special date', async () => {
    const token = await ESRToken.deployed();
    // Token locked
    assert.equal(await token.locked.call(), true);
    // All actions locked
    await assertEvmThrows(token.transfer(actors.someone1, 1, { from: actors.owner }));
    await assertEvmThrows(token.transferFrom(actors.someone1, actors.someone1, 1, { from: actors.owner }));
    await assertEvmThrows(token.approve(actors.someone1, 1, { from: actors.owner }));
    // Unlock allowed only for owner after 2019-10-01T00:00:00.000Z
    await assertEvmThrows(token.unlock({ from: actors.owner }));
  });

  it('should be ownable token', async () => {
    const token = await ESRToken.deployed();
    // Token owner
    assert.equal(await token.owner.call(), actors.owner);
    // transferOwnership allowed only for owner
    await assertEvmThrows(token.transferOwnership(actors.someone2, { from: actors.someone1 }));
    let txres = await token.transferOwnership(actors.someone1, { from: actors.owner });
    assert.equal(txres.logs[0].event, 'OwnershipTransferred');
    assert.equal(txres.logs[0].args.previousOwner, actors.owner);
    assert.equal(txres.logs[0].args.newOwner, actors.someone1);

    // Change token owner
    assert.equal(await token.owner.call(), actors.someone1);
    await assertEvmThrows(token.unlock({ from: actors.owner }));

    // Check access
    await assertEvmThrows(token.transferOwnership(actors.someone2, { from: actors.owner }));

    // Return ownership
    txres = await token.transferOwnership(actors.owner, { from: actors.someone1 });
    assert.equal(txres.logs[0].event, 'OwnershipTransferred');
    assert.equal(txres.logs[0].args.previousOwner, actors.someone1);
    assert.equal(txres.logs[0].args.newOwner, actors.owner);
  });

  it('should be not be payable token', async () => {
    const token = await ESRToken.deployed();
    await assertEvmThrows(token.sendTransaction({ value: tokens(1), from: actors.owner }));
    await assertEvmThrows(token.sendTransaction({ value: tokens(1), from: actors.someone1 }));
  });

  it('should allow private token distribution', async () => {
    const token = await ESRToken.deployed();
    assert.equal(new BigNumber(await token.getReservedTokens.call(TokenReservation.Team)).toString(), tokens(12e6));
    assert.equal(new BigNumber(await token.getReservedTokens.call(TokenReservation.Bounty)).toString(), tokens(30e6));
    assert.equal(new BigNumber(await token.getReservedTokens.call(TokenReservation.Partners)).toString(), tokens(18e6));

    // Reserve tokens from team group
    let txres = await token.assignReserved(actors.reserve1, TokenReservation.Team, tokens(1e6), {
      from: actors.owner
    });
    assert.equal(txres.logs[0].event, 'ReservedTokensDistributed');
    assert.equal(txres.logs[0].args.to, actors.reserve1);
    assert.equal(txres.logs[0].args.group, TokenReservation.Team);
    assert.equal(txres.logs[0].args.amount.toString(), tokens(1e6));

    assert.equal(await token.balanceOf.call(actors.reserve1), tokens(1e6));

    // Check reserved tokens
    assert.equal(await token.getReservedTokens.call(TokenReservation.Team), tokens(11e6)); // 12e6 - 1e6
    // Do not allow reserve more than allowed tokens
    await assertEvmInvalidOpcode(
      token.assignReserved(actors.reserve1, TokenReservation.Team, tokens(11e6 + 1), { from: actors.owner })
    );

    // Reserve tokens from bounty group
    txres = await token.assignReserved(actors.reserve2, TokenReservation.Bounty, tokens(10e6), {
      from: actors.owner
    });
    assert.equal(txres.logs[0].event, 'ReservedTokensDistributed');
    assert.equal(txres.logs[0].args.to, actors.reserve2);
    assert.equal(txres.logs[0].args.group, TokenReservation.Bounty);
    assert.equal(txres.logs[0].args.amount.toString(), tokens(10e6));

    assert.equal(await token.balanceOf.call(actors.reserve2), tokens(10e6));

    // Check reserved tokens
    assert.equal(await token.getReservedTokens.call(TokenReservation.Bounty), tokens(20e6)); // 30e6 - 10e6
    // Do not allow reserve more than allowed tokens
    await assertEvmInvalidOpcode(
      token.assignReserved(actors.reserve2, TokenReservation.Bounty, tokens(20e6 + 1), { from: actors.owner })
    );

    // Reserve tokens from partners group
    txres = await token.assignReserved(actors.reserve3, TokenReservation.Partners, tokens(6e6), {
      from: actors.owner
    });
    assert.equal(txres.logs[0].event, 'ReservedTokensDistributed');
    assert.equal(txres.logs[0].args.to, actors.reserve3);
    assert.equal(txres.logs[0].args.group, TokenReservation.Partners);
    assert.equal(txres.logs[0].args.amount.toString(), tokens(6e6));

    assert.equal(await token.balanceOf.call(actors.reserve3), tokens(6e6));

    // Check reserved tokens
    assert.equal(await token.getReservedTokens.call(TokenReservation.Partners), tokens(12e6)); // 18e6 - 6e6
    // Do not allow reserve more than allowed tokens
    await assertEvmInvalidOpcode(
      token.assignReserved(actors.reserve3, TokenReservation.Partners, tokens(12e6 + 1), { from: actors.owner })
    );

    // Do not allow token reservation from others
    await assertEvmThrows(
      token.assignReserved(actors.team1, TokenReservation.Partners, tokens(1e6), { from: actors.someone1 })
    );
  });

  it('should allow sell tokens via fiat before ICO', async () => {
    const token = await ESRToken.deployed();

    // Token is not controlled by any ICO
    assert.equal(await token.ico.call(), '0x0000000000000000000000000000000000000000');

    // Perform investments (investor1)
    state.availableTokens = state.availableTokens.sub(tokens(7200));
    const txres = await token.sellToken(actors.investor1, tokens(7200), tokens(2000), {from: actors.owner});
    assert.equal(txres.logs[0].event, 'ReservedTokensDistributed');
    assert.equal(txres.logs[0].args.to, actors.investor1);
    assert.equal(txres.logs[0].args.group, TokenReservation.Bounty);
    assert.equal(
        txres.logs[0].args.amount,
        tokens(2000)
    );
    assert.equal(txres.logs[1].event, 'SellToken');
    assert.equal(txres.logs[1].args.to, actors.investor1);
    assert.equal(
        txres.logs[1].args.amount,
        tokens(7200)
    );
    assert.equal(
        txres.logs[1].args.bonusAmount,
        tokens(2000)
    );
    assert.equal(await token.balanceOf.call(actors.investor1), tokens(7200 + 2000));
    assert.equal(await token.availableSupply.call(), state.availableTokens.toString());
  });

  it('should ico contract deployed', async () => {
    const token = await ESRToken.deployed();
    Ico = await ESRTICO.new(
      token.address,
      actors.teamWallet,
      {
        from: actors.owner
      }
    );
    state.teamWalletInitialBalance =
      state.teamWalletBalance = await web3.eth.getBalance(actors.teamWallet);
    assert.equal(await Ico.token.call(), token.address);
    assert.equal(await Ico.teamWallet.call(), actors.teamWallet);
    assert.equal(await Ico.lowCapTokens.call(), new BigNumber('15e23').toString());
    assert.equal(await Ico.hardCapTokens.call(), new BigNumber('60e24').toString());
    assert.equal(await Ico.lowCapTxWei.call(), new BigNumber('5e16').toString());
    assert.equal(await Ico.hardCapTxWei.call(), new BigNumber('1e30').toString());

    // Token is not controlled by any ICO
    assert.equal(await token.ico.call(), '0x0000000000000000000000000000000000000000');
    // Assign ICO controller contract
    const txres = await token.changeICO(Ico.address, { from: actors.owner });
    assert.equal(txres.logs[0].event, 'ICOChanged');
    assert.equal(await token.ico.call(), Ico.address);
    // Ensure no others can check ICO contract fot token
    await assertEvmThrows(token.changeICO(Ico.address, { from: actors.someone1 }));
    // Check ico state
    assert.equal(await Ico.state.call(), ICOState.Inactive);
  });

  it('check whitelist access', async () => {
    assert.isTrue(Ico != null);
    const ico = Ico!!;

    await assertEvmThrows(ico.disableWhitelist({ from: actors.someone1 }));
    await assertEvmThrows(ico.whitelist(actors.someone1, { from: actors.someone1 }));
    await ico.disableWhitelist({ from: actors.owner });
    await ico.enableWhitelist({ from: actors.owner });
  });

  it('ICO lifecycle: start', async () => {
    assert.isTrue(Ico != null);
    const ico = Ico!!;
    assert.equal(await ico.state.call(), ICOState.Inactive);

    await ico.start(END_AT, { from: actors.owner });
    assert.equal(await ico.state.call(), ICOState.Active);
    assert.equal(await ico.endAt.call(), END_AT);
  });

  it('ICO lifecycle: invest (with 20% bonus)', async () => {
    const token = await ESRToken.deployed();
    assert.isTrue(Ico != null);
    const ico = Ico!!;

    assert.equal(await ico.state.call(), ICOState.Active);

    // Check link
    assert.equal(await token.ico.call(), ico.address);
    assert.equal(await ico.token.call(), token.address);

    // Perform investments (investor1)
    let investor1Tokens = new BigNumber(await token.balanceOf.call(actors.investor1));
    const balance = web3.eth.getBalance(actors.investor1);
    assert.equal(balance.toString(), new BigNumber('100e18').toString());

    // Check deny not white-listed addresses
    const invest1 = tokens2wei(7200, state.exchangeEthTokenRatio, 20);
    await assertEvmThrows(
      ico.sendTransaction({
        value: invest1,
        from: actors.investor1
      })
    );

    // Add investor1 to white-list
    await ico.whitelist(actors.investor1);
    // Now it can buy tokens
    state.availableTokens = state.availableTokens.sub(tokens(7200 * 100 / 120)); // 7200 - 20%
    state.collectedTokens = state.collectedTokens.add(tokens(7200 * 100 / 120));
    let txres = await ico.sendTransaction({
      value: invest1,
      from: actors.investor1
    });
    state.sentWei = state.sentWei.add(invest1);
    state.investor1Wei = state.investor1Wei.add(invest1);
    assert.equal(txres.logs[0].event, 'ICOInvestment');
    assert.equal(txres.logs[0].args.investedWei, invest1.toString());
    assert.equal(txres.logs[0].args.bonusPct, 20);
    assert.equal(
      txres.logs[0].args.tokens,
      wei2rawtokens(txres.logs[0].args.investedWei, state.exchangeEthTokenRatio, 20).toString()
    );
    investor1Tokens = investor1Tokens.add(txres.logs[0].args.tokens);
    assert.equal(await token.balanceOf.call(actors.investor1), investor1Tokens.toString());
    assert.equal(await token.availableSupply.call(), state.availableTokens.toString());

    state.teamWalletBalance = state.teamWalletBalance.add(invest1);
    assert.equal(web3.eth.getBalance(actors.teamWallet).toString(), state.teamWalletBalance.toString());
    assert.equal(await ico.collectedTokens.call(), state.collectedTokens.toString());

    // Add investor2 to white-list
    await ico.whitelist(actors.investor2);
    state.availableTokens = state.availableTokens.sub(tokens(14400 * 100 / 120)); // 14400 - 20%
    state.collectedTokens = state.collectedTokens.add(tokens(14400 * 100 / 120));
    const invest2 = tokens2wei(14400, state.exchangeEthTokenRatio, 20);

    await web3IncreaseTimeTo(BONUS_20_END_AT - Seconds.minutes(1));
    txres = await ico.buyTokens({
      value: invest2,
      from: actors.investor2
    });
    state.sentWei = state.sentWei.add(invest2);
    state.investor2Wei = state.investor2Wei.add(invest2);
    assert.equal(txres.logs[0].event, 'ICOInvestment');
    assert.equal(txres.logs[0].args.investedWei, invest2.toString());
    assert.equal(txres.logs[0].args.bonusPct, 20);
    assert.equal(
      txres.logs[0].args.tokens,
      wei2rawtokens(txres.logs[0].args.investedWei, state.exchangeEthTokenRatio, 20).toString()
    );
    assert.equal(await token.balanceOf.call(actors.investor2), txres.logs[0].args.tokens.toString());
    assert.equal(await token.availableSupply.call(), state.availableTokens.toString());

    state.teamWalletBalance = state.teamWalletBalance.add(invest2);
    assert.equal(web3.eth.getBalance(actors.teamWallet).toString(), state.teamWalletBalance.toString());
    assert.equal(await ico.collectedTokens.call(), state.collectedTokens.toString());
  });

  it('should allow sell tokens via fiat during ICO', async () => {
    const token = await ESRToken.deployed();

    // Perform investments (investor3)
    state.availableTokens = state.availableTokens.sub(tokens(9900));
    const txres = await token.sellToken(actors.investor3, tokens(9900), tokens(1000), {from: actors.owner});
    assert.equal(txres.logs[0].event, 'ReservedTokensDistributed');
    assert.equal(txres.logs[0].args.to, actors.investor3);
    assert.equal(txres.logs[0].args.group, TokenReservation.Bounty);
    assert.equal(
        txres.logs[0].args.amount,
        tokens(1000)
    );
    assert.equal(txres.logs[1].event, 'SellToken');
    assert.equal(txres.logs[1].args.to, actors.investor3);
    assert.equal(
        txres.logs[1].args.amount,
        tokens(9900)
    );
    assert.equal(
        txres.logs[1].args.bonusAmount,
        tokens(1000)
    );
    assert.equal(await token.balanceOf.call(actors.investor3), tokens(9900 + 1000));
    assert.equal(await token.availableSupply.call(), state.availableTokens.toString());
  });

  it('ICO lifecycle: invest (with 10% bonus)', async () => {
    const token = await ESRToken.deployed();
    assert.isTrue(Ico != null);
    const ico = Ico!!;

    assert.equal(await ico.state.call(), ICOState.Active);

    // Check link
    assert.equal(await token.ico.call(), ico.address);
    assert.equal(await ico.token.call(), token.address);

    await web3IncreaseTimeTo(BONUS_20_END_AT + 1);

    // Perform investments (investor3)
    let investor3Tokens = new BigNumber(await token.balanceOf.call(actors.investor3));
    const balance = web3.eth.getBalance(actors.investor3);
    assert.equal(balance.toString(), new BigNumber('100e18').toString());

    // Check deny not white-listed addresses
    const invest3 = tokens2wei(9900, state.exchangeEthTokenRatio, 10);
    await assertEvmThrows(
      ico.sendTransaction({
        value: invest3,
        from: actors.investor3
      })
    );

    // Add investor3 to white-list
    await ico.whitelist(actors.investor3);
    // Now it can buy tokens
    state.availableTokens = state.availableTokens.sub(tokens(9900 * 100 / 110)); // 9900 - 10%
    state.collectedTokens = state.collectedTokens.add(tokens(9900 * 100 / 110));
    let txres = await ico.sendTransaction({
      value: invest3,
      from: actors.investor3
    });
    state.sentWei = state.sentWei.add(invest3);
    state.investor3Wei = state.investor3Wei.add(invest3);
    assert.equal(txres.logs[0].event, 'ICOInvestment');
    assert.equal(txres.logs[0].args.investedWei, invest3.toString());
    assert.equal(txres.logs[0].args.bonusPct, 10);
    assert.equal(
      txres.logs[0].args.tokens,
      wei2rawtokens(txres.logs[0].args.investedWei, state.exchangeEthTokenRatio, 10).toString()
    );
    investor3Tokens = investor3Tokens.add(txres.logs[0].args.tokens);
    assert.equal(await token.balanceOf.call(actors.investor3), investor3Tokens.toString());
    assert.equal(await token.availableSupply.call(), state.availableTokens.toString());

    state.teamWalletBalance = state.teamWalletBalance.add(invest3);
    assert.equal(web3.eth.getBalance(actors.teamWallet).toString(), state.teamWalletBalance.toString());
    assert.equal(await ico.collectedTokens.call(), state.collectedTokens.toString());

    // Tune ETH/Token ratio
    state.exchangeEthTokenRatio = new BigNumber(2000 ).mul(ETH_TOKEN_EXCHANGE_RATIO_MULTIPLIER);
    txres = await token.updateTokenExchangeRatio(state.exchangeEthTokenRatio.toString(), { from: actors.owner });
    assert.equal(txres.logs[0].event, 'EthTokenExchangeRatioUpdated');
    assert.equal(txres.logs[0].args.ethTokenExchangeRatio, state.exchangeEthTokenRatio.toString());
    assert.equal(await token.ethTokenExchangeRatio.call(), state.exchangeEthTokenRatio.toString());
    // Only owner can change ETH/Token ratio
    await assertEvmThrows(token.updateTokenExchangeRatio(1, { from: actors.someone1 }));

    // Add investor4 to white-list
    await ico.whitelist(actors.investor4);
    state.availableTokens = state.availableTokens.sub(tokens(6600 * 100 / 110)); // 6600 - 10%
    state.collectedTokens = state.collectedTokens.add(tokens(6600 * 100 / 110));
    const invest4 = tokens2wei(6600, state.exchangeEthTokenRatio, 10);
    await web3IncreaseTimeTo(BONUS_10_END_AT - Seconds.minutes(1));
    txres = await ico.buyTokens({
      value: invest4,
      from: actors.investor4
    });
    state.sentWei = state.sentWei.add(invest4);
    state.investor4Wei = state.investor4Wei.add(invest4);
    assert.equal(txres.logs[0].event, 'ICOInvestment');
    assert.equal(txres.logs[0].args.investedWei, invest4.toString());
    assert.equal(txres.logs[0].args.bonusPct, 10);
    assert.equal(
      txres.logs[0].args.tokens,
      wei2rawtokens(txres.logs[0].args.investedWei, state.exchangeEthTokenRatio, 10).toString()
    );
    assert.equal(await token.balanceOf.call(actors.investor4), txres.logs[0].args.tokens.toString());
    assert.equal(await token.availableSupply.call(), state.availableTokens.toString());

    state.teamWalletBalance = state.teamWalletBalance.add(invest4);
    assert.equal(web3.eth.getBalance(actors.teamWallet).toString(), state.teamWalletBalance.toString());
    assert.equal(await ico.collectedTokens.call(), state.collectedTokens.toString());
  });

  it('ICO lifecycle: invest (with 5% bonus)', async () => {
    const token = await ESRToken.deployed();
    assert.isTrue(Ico != null);
    const ico = Ico!!;

    assert.equal(await ico.state.call(), ICOState.Active);

    // Check link
    assert.equal(await token.ico.call(), ico.address);
    assert.equal(await ico.token.call(), token.address);

    await web3IncreaseTimeTo(BONUS_10_END_AT + 1);

    // Perform investments (investor5)
    let investor5Tokens = new BigNumber(0);
    const balance = web3.eth.getBalance(actors.investor5);
    assert.equal(balance.toString(), new BigNumber('100e18').toString());

    // Check deny not white-listed addresses
    const invest5 = tokens2wei(6300, state.exchangeEthTokenRatio, 5);
    await assertEvmThrows(
      ico.sendTransaction({
        value: invest5,
        from: actors.investor5
      })
    );

    // Add investor5 to white-list
    await ico.whitelist(actors.investor5);
    // Now it can buy tokens
    state.availableTokens = state.availableTokens.sub(tokens(6300 * 100 / 105)); // 6300 - 5%
    state.collectedTokens = state.collectedTokens.add(tokens(6300 * 100 / 105));
    let txres = await ico.sendTransaction({
      value: invest5,
      from: actors.investor5
    });
    state.sentWei = state.sentWei.add(invest5);
    state.investor5Wei = state.investor5Wei.add(invest5);
    assert.equal(txres.logs[0].event, 'ICOInvestment');
    assert.equal(txres.logs[0].args.investedWei, invest5.toString());
    assert.equal(txres.logs[0].args.bonusPct, 5);
    assert.equal(
      txres.logs[0].args.tokens,
      wei2rawtokens(txres.logs[0].args.investedWei, state.exchangeEthTokenRatio, 5).toString()
    );
    investor5Tokens = investor5Tokens.add(txres.logs[0].args.tokens);
    assert.equal(await token.balanceOf.call(actors.investor5), txres.logs[0].args.tokens.toString());
    assert.equal(await token.balanceOf.call(actors.investor5), investor5Tokens.toString());
    assert.equal(await token.availableSupply.call(), state.availableTokens.toString());

    state.teamWalletBalance = state.teamWalletBalance.add(invest5);
    assert.equal(web3.eth.getBalance(actors.teamWallet).toString(), state.teamWalletBalance.toString());
    assert.equal(await ico.collectedTokens.call(), state.collectedTokens.toString());

    // tuning ICO: set new BONUS_05_END_AT date
    txres = await ico.suspend({ from: actors.owner });
    assert.equal(txres.logs[0].event, 'ICOSuspended');
    assert.equal(await ico.state.call(), ICOState.Suspended);

    // only owner can tune
    await assertEvmThrows(ico.tuneLastStageStartAt(0, {from: actors.someone1}));
    // new date must be smaller than current
    await assertEvmThrows(ico.tuneLastStageStartAt(BONUS_05_END_AT + 1, {from: actors.owner}));
    await ico.tuneLastStageStartAt(BONUS_05_END_AT - Seconds.hours(1), {from: actors.owner});
    BONUS_05_END_AT = BONUS_05_END_AT - Seconds.hours(1);
    assert.equal(await ico.lastStageStartAt.call(), BONUS_05_END_AT);

    txres = await ico.resume({ from: actors.owner });
    assert.equal(txres.logs[0].event, 'ICOResumed');
    assert.equal(txres.logs[0].args.endAt, END_AT.toString());
    assert.equal(txres.logs[0].args.lowCapTokens, new BigNumber('15e23').toString());
    assert.equal(txres.logs[0].args.hardCapTokens, new BigNumber('60e24').toString());
    assert.equal(txres.logs[0].args.lowCapTxWei, new BigNumber('5e16').toString());
    assert.equal(txres.logs[0].args.hardCapTxWei, new BigNumber('1e30').toString());
    assert.equal(await ico.state.call(), ICOState.Active);

    // Tune ETH/Token ratio
    state.exchangeEthTokenRatio = new BigNumber(1000 ).mul(ETH_TOKEN_EXCHANGE_RATIO_MULTIPLIER);
    txres = await token.updateTokenExchangeRatio(state.exchangeEthTokenRatio.toString(), { from: actors.owner });
    assert.equal(txres.logs[0].event, 'EthTokenExchangeRatioUpdated');
    assert.equal(txres.logs[0].args.ethTokenExchangeRatio, state.exchangeEthTokenRatio.toString());
    assert.equal(await token.ethTokenExchangeRatio.call(), state.exchangeEthTokenRatio.toString());
    // Only owner can change ETH/Token ratio
    await assertEvmThrows(token.updateTokenExchangeRatio(1, { from: actors.someone1 }));

    // Add investor6 to white-list
    await ico.whitelist(actors.investor6);
    state.availableTokens = state.availableTokens.sub(tokens(21000 * 100 / 105)); // 21000 - 5%
    state.collectedTokens = state.collectedTokens.add(tokens(21000 * 100 / 105));
    const invest6 = tokens2wei(21000, state.exchangeEthTokenRatio, 5);
    await web3IncreaseTimeTo(BONUS_05_END_AT - Seconds.minutes(1));
    txres = await ico.buyTokens({
      value: invest6,
      from: actors.investor6
    });
    state.sentWei = state.sentWei.add(invest6);
    state.investor6Wei = state.investor6Wei.add(invest6);
    assert.equal(txres.logs[0].event, 'ICOInvestment');
    assert.equal(txres.logs[0].args.investedWei, invest6.toString());
    assert.equal(txres.logs[0].args.bonusPct, 5);
    assert.equal(
      txres.logs[0].args.tokens,
      wei2rawtokens(txres.logs[0].args.investedWei, state.exchangeEthTokenRatio, 5).toString()
    );
    assert.equal(await token.balanceOf.call(actors.investor6), txres.logs[0].args.tokens.toString());
    assert.equal(await token.availableSupply.call(), state.availableTokens.toString());

    state.teamWalletBalance = state.teamWalletBalance.add(invest6);
    assert.equal(web3.eth.getBalance(actors.teamWallet).toString(), state.teamWalletBalance.toString());
    assert.equal(await ico.collectedTokens.call(), state.collectedTokens.toString());
  });

  it('ICO lifecycle: invest (with 0% bonus, reach lowcap)', async () => {
    const token = await ESRToken.deployed();
    assert.isTrue(Ico != null);
    const ico = Ico!!;

    assert.equal(await ico.state.call(), ICOState.Active);

    // Check link
    assert.equal(await token.ico.call(), ico.address);
    assert.equal(await ico.token.call(), token.address);

    // tuning ICO: set low soft capacity to make available to fill it
    let txres = await ico.suspend({ from: actors.owner });
    assert.equal(txres.logs[0].event, 'ICOSuspended');
    assert.equal(await ico.state.call(), ICOState.Suspended);

    // only owner can tune
    await assertEvmThrows(ico.tune(0,
      new BigNumber('62.4e21'),
      new BigNumber('66e21'), 0, 0, { from: actors.someone1 }));
    await ico.tune(END_AT - Seconds.hours(1),
      new BigNumber('62.4e21'),
      new BigNumber('66e21'), 0, 0, { from: actors.owner });

    // check that end date, low and hard cap changed
    assert.equal(await ico.token.call(), token.address);
    assert.equal(await ico.teamWallet.call(), actors.teamWallet);
    assert.equal(await ico.lowCapTokens.call(), new BigNumber('62.4e21').toString());
    assert.equal(await ico.hardCapTokens.call(), new BigNumber('66e21').toString());
    assert.equal(await ico.lowCapTxWei.call(), new BigNumber('5e16').toString());
    assert.equal(await ico.hardCapTxWei.call(), new BigNumber('1e30').toString());

    assert.equal(await ico.state.call(), ICOState.Suspended);

    txres = await ico.resume({ from: actors.owner });
    assert.equal(txres.logs[0].event, 'ICOResumed');
    assert.equal(txres.logs[0].args.endAt, (END_AT - Seconds.hours(1)).toString());
    assert.equal(txres.logs[0].args.lowCapTokens, new BigNumber('62.4e21').toString());
    assert.equal(txres.logs[0].args.hardCapTokens, new BigNumber('66e21').toString());
    assert.equal(txres.logs[0].args.lowCapTxWei, new BigNumber('5e16').toString());
    assert.equal(txres.logs[0].args.hardCapTxWei, new BigNumber('1e30').toString());
    assert.equal(await ico.state.call(), ICOState.Active);
    END_AT = END_AT - Seconds.hours(1);
    assert.equal(await ico.endAt.call(), END_AT);

    let requiredTokens = new BigNumber(await ico.hardCapTokens.call()).sub(await ico.collectedTokens.call());
    requiredTokens = requiredTokens.div(2);

    await web3IncreaseTimeTo(BONUS_05_END_AT + 1);
    // Perform investments (investor7)
    let investor7Tokens = new BigNumber(0);
    const balance = web3.eth.getBalance(actors.investor7);
    assert.equal(balance.toString(), new BigNumber('100e18').toString());

    // Check deny not white-listed addresses
    const invest7 = tokens2wei(requiredTokens.div(ONE_TOKEN), state.exchangeEthTokenRatio, 0);
    await assertEvmThrows(
      ico.sendTransaction({
        value: invest7,
        from: actors.investor7
      })
    );

    // Add investor7 to white-list
    await ico.whitelist(actors.investor7);
    // Now it can buy tokens
    state.availableTokens = state.availableTokens.sub(requiredTokens);
    state.collectedTokens = state.collectedTokens.add(requiredTokens);
    txres = await ico.sendTransaction({
      value: invest7,
      from: actors.investor7
    });
    state.sentWei = state.sentWei.add(invest7);
    state.investor7Wei = state.investor7Wei.add(invest7);
    assert.equal(txres.logs[0].event, 'ICOInvestment');
    assert.equal(txres.logs[0].args.investedWei, invest7.toString());
    assert.equal(txres.logs[0].args.bonusPct, 0);
    assert.equal(
      txres.logs[0].args.tokens,
      wei2rawtokens(txres.logs[0].args.investedWei, state.exchangeEthTokenRatio, 0).toString()
    );
    investor7Tokens = investor7Tokens.add(txres.logs[0].args.tokens);
    assert.equal(await token.balanceOf.call(actors.investor7), txres.logs[0].args.tokens.toString());
    assert.equal(await token.balanceOf.call(actors.investor7), investor7Tokens.toString());
    assert.equal(await token.availableSupply.call(), state.availableTokens.toString());

    state.teamWalletBalance = state.teamWalletBalance.add(invest7);
    assert.equal(web3.eth.getBalance(actors.teamWallet).toString(), state.teamWalletBalance.toString());
    assert.equal(await ico.collectedTokens.call(), state.collectedTokens.toString());

    assert.equal(await ico.state.call(), ICOState.Active);
  });

  it('ICO lifecycle: complete (with 0% bonus, reach hardcap)', async () => {
    const token = await ESRToken.deployed();
    assert.isTrue(Ico != null);
    const ico = Ico!!;

    assert.equal(await ico.state.call(), ICOState.Active);

    // Check link
    assert.equal(await token.ico.call(), ico.address);
    assert.equal(await ico.token.call(), token.address);

    const requiredTokens = new BigNumber(await ico.hardCapTokens.call()).sub(await ico.collectedTokens.call());

    // Perform investments (investor8)
    let investor8Tokens = new BigNumber(0);
    const balance = web3.eth.getBalance(actors.investor8);
    assert.equal(balance.toString(), new BigNumber('100e18').toString());

    // Check deny not white-listed addresses
    const invest8 = tokens2wei(requiredTokens.div(ONE_TOKEN), state.exchangeEthTokenRatio, 0);
    await assertEvmThrows(
      ico.sendTransaction({
        value: invest8,
        from: actors.investor8
      })
    );

    // Add investor8 to white-list
    await ico.whitelist(actors.investor8);
    // Now it can buy tokens
    state.availableTokens = state.availableTokens.sub(requiredTokens);
    state.ownerTokens = state.ownerTokens.add(state.availableTokens);
    state.availableTokens = new BigNumber(0);
    state.collectedTokens = state.collectedTokens.add(requiredTokens);
    const txres = await ico.sendTransaction({
      value: invest8,
      from: actors.investor8
    });
    state.sentWei = state.sentWei.add(invest8);
    state.investor8Wei = state.investor8Wei.add(invest8);
    assert.equal(txres.logs[0].event, 'ICOInvestment');
    assert.equal(txres.logs[0].args.investedWei, invest8.toString());
    assert.equal(txres.logs[0].args.bonusPct, 0);
    assert.equal(
      txres.logs[0].args.tokens,
      wei2rawtokens(txres.logs[0].args.investedWei, state.exchangeEthTokenRatio, 0).toString()
    );
    assert.equal(txres.logs[1].event, 'ICOCompleted');
    assert.equal(txres.logs[1].args.collectedTokens, state.collectedTokens.toString());
    investor8Tokens = investor8Tokens.add(txres.logs[0].args.tokens);
    assert.equal(await token.balanceOf.call(actors.investor8), txres.logs[0].args.tokens.toString());
    assert.equal(await token.balanceOf.call(actors.investor8), investor8Tokens.toString());
    assert.equal(await token.balanceOf.call(actors.owner), state.ownerTokens.toString());
    assert.equal(await token.availableSupply.call(), state.availableTokens.toString());

    state.teamWalletBalance = state.teamWalletBalance.add(invest8);
    assert.equal(web3.eth.getBalance(actors.teamWallet).toString(), state.teamWalletBalance.toString());

    assert.equal(await ico.state.call(), ICOState.Completed);
    assert.equal(await ico.collectedTokens.call(), state.collectedTokens.toString());

    // Cannot invest anymore
    await assertEvmThrows(
      ico.sendTransaction({
        value: 1,
        from: actors.investor8
      })
    );
  });

  it('should team wallet match invested funds after ICO', async () => {
    assert.equal(
      new BigNumber(web3.eth.getBalance(actors.teamWallet)).sub(state.teamWalletInitialBalance).toString(),
      state.sentWei.toString()
    );

    assert.equal(state.investor1Wei
      .add(state.investor2Wei)
      .add(state.investor3Wei)
      .add(state.investor4Wei)
      .add(state.investor5Wei)
      .add(state.investor6Wei)
      .add(state.investor7Wei)
      .add(state.investor8Wei).toString(), state.sentWei.toString());
  });

  it('should be lockable token after special date', async () => {
    const token = await ESRToken.deployed();
    // Token locked
    assert.equal(await token.locked.call(), true);
    // Unlock allowed only for owner after 2019-10-01T00:00:00.000Z
    await assertEvmThrows(token.unlock({ from: actors.owner }));

    await web3IncreaseTimeTo(TOKEN_UNLOCK_AT - Seconds.minutes(1));
    await assertEvmThrows(token.unlock({ from: actors.owner }));
    await web3IncreaseTimeTo(TOKEN_UNLOCK_AT + 1);

    // Unlock allowed only for owner
    await assertEvmThrows(token.unlock({ from: actors.someone1 }));
    let txres = await token.unlock({ from: actors.owner });
    assert.equal(txres.logs[0].event, 'Unlock');

    // Token unlocked
    assert.equal(await token.locked.call(), false);

    // Lock allowed only for owner
    await assertEvmThrows(token.lock({ from: actors.someone1 }));
    txres = await token.lock({ from: actors.owner });
    assert.equal(txres.logs[0].event, 'Lock');
  });

  it('should token allow transfer', async () => {
    const token = await ESRToken.deployed();
    let reserve1TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve1));
    let reserve2TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve2));
    let reserve3TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve3));

    // Token should be unlocked
    assert.equal(await token.locked.call(), true);
    await token.unlock({ from: actors.owner });
    assert.equal(await token.locked.call(), false);

    // Cannot transfer more than balance
    await assertEvmThrows(token.transfer(actors.reserve2, reserve1TokenBalance.add(1), { from: actors.reserve1 }));

    // Check transfer
    let transfer = new BigNumber(tokens('2e5'));
    let txres = await token.transfer(actors.reserve2, transfer.toString(), { from: actors.reserve1 });
    assert.equal(txres.logs[0].event, 'Transfer');
    assert.equal(txres.logs[0].args.from, actors.reserve1);
    assert.equal(txres.logs[0].args.to, actors.reserve2);
    assert.equal(txres.logs[0].args.value, transfer.toString());
    // Check balances
    reserve1TokenBalance = reserve1TokenBalance.sub(transfer);
    reserve2TokenBalance = reserve2TokenBalance.add(transfer);
    assert.equal(await token.balanceOf.call(actors.reserve1), reserve1TokenBalance.toString());
    assert.equal(await token.balanceOf.call(actors.reserve2), reserve2TokenBalance.toString());

    transfer = new BigNumber(tokens('1e5'));
    txres = await token.transfer(actors.reserve3, transfer.toString(), { from: actors.reserve2 });
    assert.equal(txres.logs[0].event, 'Transfer');
    assert.equal(txres.logs[0].args.from, actors.reserve2);
    assert.equal(txres.logs[0].args.to, actors.reserve3);
    assert.equal(txres.logs[0].args.value, transfer.toString());
    // Check balances
    reserve2TokenBalance = reserve2TokenBalance.sub(transfer);
    reserve3TokenBalance = reserve3TokenBalance.add(transfer);
    assert.equal(await token.balanceOf.call(actors.reserve2), reserve2TokenBalance.toString());
    assert.equal(await token.balanceOf.call(actors.reserve3), reserve3TokenBalance.toString());

    await token.lock({ from: actors.owner });
    assert.equal(await token.locked.call(), true);
  });

  it('should token allow transferFrom', async () => {
    const token = await ESRToken.deployed();
    let reserve1TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve1));
    const reserve2TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve2));
    let reserve3TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve3));

    // Token should be unlocked
    assert.equal(await token.locked.call(), true);
    await token.unlock({ from: actors.owner });
    assert.equal(await token.locked.call(), false);

    // Cannot transferFrom without approve
    await assertEvmThrows(token.transferFrom(actors.reserve1, actors.reserve3, 1, { from: actors.reserve2 }));

    // Approve
    let approve = new BigNumber(tokens('2e5'));
    let transfer = approve.div(2);
    let txres = await token.approve(actors.reserve2, approve.toString(), { from: actors.reserve1 });
    assert.equal(txres.logs[0].event, 'Approval');
    assert.equal(txres.logs[0].args.owner, actors.reserve1);
    assert.equal(txres.logs[0].args.spender, actors.reserve2);
    assert.equal(txres.logs[0].args.value, approve.toString());
    assert.equal(await token.allowance.call(actors.reserve1, actors.reserve2), approve.toString());

    // Cannot transfer more than allowed
    await assertEvmThrows(token.transferFrom(actors.reserve1, actors.reserve3, approve.add(1), { from: actors.reserve2 }));

    // Check transferFrom
    txres = await token.transferFrom(actors.reserve1, actors.reserve3, transfer.toString(), { from: actors.reserve2 });
    assert.equal(txres.logs[0].event, 'Transfer');
    assert.equal(txres.logs[0].args.from, actors.reserve1);
    assert.equal(txres.logs[0].args.to, actors.reserve3);
    assert.equal(txres.logs[0].args.value, transfer.toString());
    assert.equal(await token.allowance.call(actors.reserve1, actors.reserve2), approve.sub(transfer).toString());

    // Check balances
    reserve1TokenBalance = reserve1TokenBalance.sub(transfer);
    reserve3TokenBalance = reserve3TokenBalance.add(transfer);
    assert.equal(await token.balanceOf.call(actors.reserve1), reserve1TokenBalance.toString());
    assert.equal(await token.balanceOf.call(actors.reserve2), reserve2TokenBalance.toString()); // not changed
    assert.equal(await token.balanceOf.call(actors.reserve3), reserve3TokenBalance.toString());

    // Double approve is forbidden (value -> 0 -> new_value)
    await assertEvmThrows(token.approve(actors.reserve2, 1, { from: actors.reserve1 }));
    txres = await token.approve(actors.reserve2, 0, { from: actors.reserve1 });
    assert.equal(txres.logs[0].event, 'Approval');
    assert.equal(txres.logs[0].args.owner, actors.reserve1);
    assert.equal(txres.logs[0].args.spender, actors.reserve2);
    assert.equal(txres.logs[0].args.value, 0);
    assert.equal(await token.allowance.call(actors.reserve1, actors.reserve2), '0');

    // Check transferFrom not from reserve1
    approve = new BigNumber(tokens('1e5'));
    transfer = approve.div(2);
    txres = await token.approve(actors.reserve2, approve.toString(), { from: actors.reserve3 });
    assert.equal(txres.logs[0].event, 'Approval');
    assert.equal(txres.logs[0].args.owner, actors.reserve3);
    assert.equal(txres.logs[0].args.spender, actors.reserve2);
    assert.equal(txres.logs[0].args.value, approve.toString());
    assert.equal(await token.allowance.call(actors.reserve3, actors.reserve2), approve.toString());

    // Cannot transfer more than allowed
    await assertEvmThrows(token.transferFrom(actors.reserve3, actors.reserve1, approve.add(1), { from: actors.reserve2 }));

    // Check transferFrom
    txres = await token.transferFrom(actors.reserve3, actors.reserve1, transfer.toString(), { from: actors.reserve2 });
    assert.equal(txres.logs[0].event, 'Transfer');
    assert.equal(txres.logs[0].args.from, actors.reserve3);
    assert.equal(txres.logs[0].args.to, actors.reserve1);
    assert.equal(txres.logs[0].args.value, transfer.toString());
    assert.equal(await token.allowance.call(actors.reserve3, actors.reserve2), approve.sub(transfer).toString());

    // Check balances
    reserve3TokenBalance = reserve3TokenBalance.sub(transfer);
    reserve1TokenBalance = reserve1TokenBalance.add(transfer);
    assert.equal(await token.balanceOf.call(actors.reserve1), reserve1TokenBalance.toString());
    assert.equal(await token.balanceOf.call(actors.reserve2), reserve2TokenBalance.toString()); // not changed
    assert.equal(await token.balanceOf.call(actors.reserve3), reserve3TokenBalance.toString());

    await token.lock({ from: actors.owner });
    assert.equal(await token.locked.call(), true);
  });

  it('should be mintable token', async () => {
    const token = await ESRToken.deployed();
    // Mint allowed only for owner after 2020-06-01T00:00:00.000Z
    await assertEvmThrows(token.mintToken(tokens(1), { from: actors.owner }));

    await web3IncreaseTimeTo(MINT_UNLOCK_AT - Seconds.minutes(1));
    await assertEvmThrows(token.mintToken(tokens(1), { from: actors.owner }));
    await web3IncreaseTimeTo(MINT_UNLOCK_AT + 1);

    // Mint allowed only for owner
    await assertEvmThrows(token.mintToken(tokens(1), { from: actors.someone1 }));
    const mintedAmount = new BigNumber(tokens(1000));
    state.ownerTokens = state.ownerTokens.add(mintedAmount);
    let totalSupply = new BigNumber(await token.totalSupply.call());
    const txres = await token.mintToken(mintedAmount.toString(), { from: actors.owner });
    totalSupply = totalSupply.add(mintedAmount);
    assert.equal(txres.logs[0].event, 'TokensMinted');
    assert.equal(txres.logs[0].args.mintedAmount, mintedAmount.toString());
    assert.equal(txres.logs[0].args.totalSupply, totalSupply.toString());
    assert.equal(await token.totalSupply.call(), totalSupply.toString());
    assert.equal(await token.balanceOf.call(actors.owner), state.ownerTokens.toString());
  });
});