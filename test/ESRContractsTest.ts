import { ItTestFn } from '../globals';
import * as BigNumber from 'bignumber.js';
import {
  IESRToken, TokenReservation
} from '../contracts';
import { assertEvmThrows, assertEvmInvalidOpcode } from './lib/assert';
import { web3LatestTime, Seconds, web3IncreaseTimeTo, web3IncreaseTime } from './lib/time';

const it = (<any>global).it as ItTestFn;
const assert = (<any>global).assert as Chai.AssertStatic;

const ESRToken = artifacts.require('./ESRToken.sol');
const ONE_TOKEN = new BigNumber('1e18');

function tokens(val: BigNumber.NumberLike): string {
  return new BigNumber(val).times(ONE_TOKEN).toString();
}

function tokens2wei(val: BigNumber.NumberLike, exchangeRatio: number): string {
  return new BigNumber(val)
    .mul(ONE_TOKEN)
    .divToInt(exchangeRatio)
    .toString();
}

function wei2rawtokens(val: BigNumber.NumberLike, exchangeRatio: number): string {
  return new BigNumber(val)
    .mul(exchangeRatio)
    .toString();
}

const state = {
  availableTokens: new BigNumber(0),
  teamWalletBalance: new BigNumber(0),
  teamWalletInitialBalance: new BigNumber(0),
  sentWei: new BigNumber(0),
  investor1Wei: new BigNumber(0),
  investor2Wei: new BigNumber(0),
  investor3Wei: new BigNumber(0),
  investor4Wei: new BigNumber(0),
  investor5Wei: new BigNumber(0),
  investor6Wei: new BigNumber(0),
  investor7Wei: new BigNumber(0),
  investor8Wei: new BigNumber(0)
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

  it('should be lockable token', async () => {
    const token = await ESRToken.deployed();
    // Token locked
    assert.equal(await token.locked.call(), true);
    // All actions locked
    await assertEvmThrows(token.transfer(actors.someone1, 1, {from: actors.owner}));
    await assertEvmThrows(token.transferFrom(actors.someone1, actors.someone1, 1, {from: actors.owner}));
    await assertEvmThrows(token.approve(actors.someone1, 1, {from: actors.owner}));
    // Unlock allowed only for owner
    await assertEvmThrows(token.unlock({from: actors.someone1}));
    let txres = await token.unlock({from: actors.owner});
    assert.equal(txres.logs[0].event, 'Unlock');

    // Token unlocked
    assert.equal(await token.locked.call(), false);

    // Lock allowed only for owner
    await assertEvmThrows(token.lock({from: actors.someone1}));
    txres = await token.lock({from: actors.owner});
    assert.equal(txres.logs[0].event, 'Lock');
  });

  it('should be ownable token', async () => {
    const token = await ESRToken.deployed();
    // Token owner
    assert.equal(await token.owner.call(), actors.owner);
    // transferOwnership allowed only for owner
    await assertEvmThrows(token.transferOwnership(actors.someone2, {from: actors.someone1}));
    let txres = await token.transferOwnership(actors.someone1, {from: actors.owner});
    assert.equal(txres.logs[0].event, 'OwnershipTransferred');
    assert.equal(txres.logs[0].args.previousOwner, actors.owner);
    assert.equal(txres.logs[0].args.newOwner, actors.someone1);

    // Change token owner
    assert.equal(await token.owner.call(), actors.someone1);
    await assertEvmThrows(token.unlock({from: actors.owner}));

    // Check access
    await assertEvmThrows(token.transferOwnership(actors.someone2, {from: actors.owner}));
    txres = await token.unlock({from: actors.someone1});
    assert.equal(txres.logs[0].event, 'Unlock');
    assert.equal(await token.locked.call(), false);
    txres = await token.lock({from: actors.someone1});
    assert.equal(txres.logs[0].event, 'Lock');
    assert.equal(await token.locked.call(), true);

    // Return ownership
    txres = await token.transferOwnership(actors.owner, {from: actors.someone1});
    assert.equal(txres.logs[0].event, 'OwnershipTransferred');
    assert.equal(txres.logs[0].args.previousOwner, actors.someone1);
    assert.equal(txres.logs[0].args.newOwner, actors.owner);
  });

  it('should be not payable token', async () => {
    const token = await ESRToken.deployed();
    await assertEvmThrows(token.sendTransaction({value: tokens(1), from: actors.owner}));
    await assertEvmThrows(token.sendTransaction({value: tokens(1), from: actors.someone1}));
  });

  it('should allow private token distribution', async () => {
    const token = await ESRToken.deployed();
    assert.equal(new BigNumber(await token.getReservedTokens.call(TokenReservation.Team)).toString(), tokens(12e6));
    assert.equal(new BigNumber(await token.getReservedTokens.call(TokenReservation.Bounty)).toString(), tokens(30e6));
    assert.equal(new BigNumber(await token.getReservedTokens.call(TokenReservation.Partners)).toString(), tokens(18e6));

    assert.equal(await token.reservedReserveLocked.call(), true);
    // Do not allow token reservation while reserve is locked
    await assertEvmThrows(
        token.assignReserved(actors.team1, TokenReservation.Team, tokens(1e6), {from: actors.owner})
    );

    // Others can't toggle reserve lock
    await assertEvmThrows(token.toggleReserveLock({from: actors.someone1}));
    await token.toggleReserveLock({from: actors.owner});
    assert.equal(await token.reservedReserveLocked.call(), false);

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
        token.assignReserved(actors.reserve1, TokenReservation.Team, tokens(11e6 + 1), {from: actors.owner})
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
        token.assignReserved(actors.reserve2, TokenReservation.Bounty, tokens(20e6 + 1), {from: actors.owner})
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
        token.assignReserved(actors.reserve3, TokenReservation.Partners, tokens(12e6 + 1), {from: actors.owner})
    );

    // Do not allow token reservation from others
    await assertEvmThrows(
        token.assignReserved(actors.team1, TokenReservation.Partners, tokens(1e6), {from: actors.someone1})
    );

    // Others can't toggle reserve lock
    await assertEvmThrows(token.toggleReserveLock({from: actors.someone1}));
    await token.toggleReserveLock({from: actors.owner});
    assert.equal(await token.reservedReserveLocked.call(), true);
  });

  it('should token allow transfer', async () => {
    const token = await ESRToken.deployed();
    let reserve1TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve1));
    let reserve2TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve2));
    let reserve3TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve3));

    // Token should be unlocked
    assert.equal(await token.locked.call(), true);
    await token.unlock({from: actors.owner});
    assert.equal(await token.locked.call(), false);

    // Cannot transfer more than balance
    await assertEvmThrows(token.transfer(actors.reserve2, reserve1TokenBalance.add(1), {from: actors.reserve1}));

    // Check transfer
    let transfer = new BigNumber(tokens('2e5'));
    let txres = await token.transfer(actors.reserve2, transfer.toString(), {from: actors.reserve1});
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
    txres = await token.transfer(actors.reserve3, transfer.toString(), {from: actors.reserve2});
    assert.equal(txres.logs[0].event, 'Transfer');
    assert.equal(txres.logs[0].args.from, actors.reserve2);
    assert.equal(txres.logs[0].args.to, actors.reserve3);
    assert.equal(txres.logs[0].args.value, transfer.toString());
    // Check balances
    reserve2TokenBalance = reserve2TokenBalance.sub(transfer);
    reserve3TokenBalance = reserve3TokenBalance.add(transfer);
    assert.equal(await token.balanceOf.call(actors.reserve2), reserve2TokenBalance.toString());
    assert.equal(await token.balanceOf.call(actors.reserve3), reserve3TokenBalance.toString());

    await token.lock({from: actors.owner});
    assert.equal(await token.locked.call(), true);
  });

  it('should token allow transferFrom', async () => {
    const token = await ESRToken.deployed();
    let reserve1TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve1));
    const reserve2TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve2));
    let reserve3TokenBalance = new BigNumber(await token.balanceOf.call(actors.reserve3));

    // Token should be unlocked
    assert.equal(await token.locked.call(), true);
    await token.unlock({from: actors.owner});
    assert.equal(await token.locked.call(), false);

    // Cannot transferFrom without approve
    await assertEvmThrows(token.transferFrom(actors.reserve1, actors.reserve3, 1, {from: actors.reserve2}));

    // Approve
    let approve = new BigNumber(tokens('2e5'));
    let transfer = approve.div(2);
    let txres = await token.approve(actors.reserve2, approve.toString(), {from: actors.reserve1});
    assert.equal(txres.logs[0].event, 'Approval');
    assert.equal(txres.logs[0].args.owner, actors.reserve1);
    assert.equal(txres.logs[0].args.spender, actors.reserve2);
    assert.equal(txres.logs[0].args.value, approve.toString());
    assert.equal(await token.allowance.call(actors.reserve1, actors.reserve2), approve.toString());

    // Cannot transfer more than allowed
    await assertEvmThrows(token.transferFrom(actors.reserve1, actors.reserve3, approve.add(1), {from: actors.reserve2}));

    // Check transferFrom
    txres = await token.transferFrom(actors.reserve1, actors.reserve3, transfer.toString(), {from: actors.reserve2});
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
    await assertEvmThrows(token.approve(actors.reserve2, 1, {from: actors.reserve1}));
    txres = await token.approve(actors.reserve2, 0, {from: actors.reserve1});
    assert.equal(txres.logs[0].event, 'Approval');
    assert.equal(txres.logs[0].args.owner, actors.reserve1);
    assert.equal(txres.logs[0].args.spender, actors.reserve2);
    assert.equal(txres.logs[0].args.value, 0);
    assert.equal(await token.allowance.call(actors.reserve1, actors.reserve2), '0');

    // Check transferFrom not from reserve1
    approve = new BigNumber(tokens('1e5'));
    transfer = approve.div(2);
    txres = await token.approve(actors.reserve2, approve.toString(), {from: actors.reserve3});
    assert.equal(txres.logs[0].event, 'Approval');
    assert.equal(txres.logs[0].args.owner, actors.reserve3);
    assert.equal(txres.logs[0].args.spender, actors.reserve2);
    assert.equal(txres.logs[0].args.value, approve.toString());
    assert.equal(await token.allowance.call(actors.reserve3, actors.reserve2), approve.toString());

    // Cannot transfer more than allowed
    await assertEvmThrows(token.transferFrom(actors.reserve3, actors.reserve1, approve.add(1), {from: actors.reserve2}));

    // Check transferFrom
    txres = await token.transferFrom(actors.reserve3, actors.reserve1, transfer.toString(), {from: actors.reserve2});
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

    await token.lock({from: actors.owner});
    assert.equal(await token.locked.call(), true);
  });
});