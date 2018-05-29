import { ItTestFn } from '../globals';
import * as BigNumber from 'bignumber.js';
import {
  IESRToken
} from '../contracts';
import { assertEvmThrows, assertEvmInvalidOpcode } from './lib/assert';
import { web3LatestTime, Seconds, web3IncreaseTimeTo, web3IncreaseTime } from './lib/time';

const it = (<any>global).it as ItTestFn;
const assert = (<any>global).assert as Chai.AssertStatic;

const ESRToken = artifacts.require('./ESRToken.sol');
const ONE_TOKEN = new BigNumber('5e14');

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
    teamWallet: accounts[cnt++]
  } as { [k: string]: string };
  console.log('Actors: ', actors);

  it('should be correct initial token state', async () => {
    const token = await ESRToken.deployed();
    // Total supply
    assert.equal(await token.totalSupply.call(), tokens('120e6'));
  });
});