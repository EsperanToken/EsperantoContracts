import 'web3-typed/callback/web3';
import * as Web3 from 'web3';
import { IContractInstance, ISimpleCallable, address, IContract, ITXResult } from './globals';
import { NumberLike } from 'bignumber.js';

interface Artifacts {
  require(name: './ESRToken.sol'): IContract<IESRToken>;
  require(name: './Migrations.sol'): IContract<IContractInstance>;
}

declare global {
  const artifacts: Artifacts;
}

declare type TokenGroup = 'team' | 'bounty' | 'partners';

declare const enum TokenReservation {
  Partners = 0x1,
  Team = 0x2,
  Bounty = 0x4
}

declare const enum ICOState {
  // ICO is not active and not started
  Inactive = 0,
  // ICO is active, tokens can be distributed among investors.
  // ICO parameters (end date, hard/low caps) cannot be changed.
  Active = 1,
  // ICO is suspended, tokens cannot be distributed among investors.
  // ICO can be resumed to `Active state`.
  // ICO parameters (end date, hard/low caps) may changed.
  Suspended = 2,
  // ICO is terminated by owner, ICO cannot be resumed.
  Terminated = 3,
  // ICO goals are not reached,
  // ICO terminated and cannot be resumed.
  NotCompleted = 4,
  // ICO completed, ICO goals reached successfully,
  // ICO terminated and cannot be resumed.
  Completed = 5
}

/**
 * The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
interface IOwnable {
  owner: ISimpleCallable<address>;
  transferOwnership(newOwner: address, tr?: Web3.TransactionRequest): Promise<ITXResult>;
}

interface IWhitelisted extends IOwnable {

  // True if whitelist enabled
  whitelistEnabled: ISimpleCallable<boolean>;

  /**
   * Add address to ICO whitelist
   * @param addr Investor address
   */
  whitelist(addr: address, tr?: Web3.TransactionRequest): Promise<ITXResult>;

  /**
   * Remove address from ICO whitelist
   * @param addr Investor address
   */
  blacklist(addr: address, tr?: Web3.TransactionRequest): Promise<ITXResult>;

  /**
   * Enable whitelisting
   */
  enableWhitelist(tr?: Web3.TransactionRequest): Promise<ITXResult>;

  /**
   * Disable whitelisting
   */
  disableWhitelist(tr?: Web3.TransactionRequest): Promise<ITXResult>;

  whitelisted: {
    /**
     * Returns true if given address in ICO whitelist
     */
    call(addr: address, tr?: Web3.TransactionRequest): Promise<boolean>;
  };
}

/**
 * Base contract which allows children to
 * implement main operations locking mechanism.
 */
interface ILockable extends IOwnable {

  locked: ISimpleCallable<boolean>;

  lock(tr?: Web3.TransactionRequest): Promise<ITXResult>;

  unlock(tr?: Web3.TransactionRequest): Promise<ITXResult>;
}

interface IBaseFixedERC20Token extends IContractInstance, ILockable {

  // ERC20 Total supply
  totalSupply: ISimpleCallable<NumberLike>;

  /**
   * Gets the balance of the specified address.
   * @param owner The address to query the the balance of.
   * @return An uint representing the amount owned by the passed address.
   */
  balanceOf: {
    call(owner: address, tr?: Web3.TransactionRequest): Promise<NumberLike>;
  };

  /**
   * Transfer token for a specified address
   * @param to The address to transfer to.
   * @param value The amount to be transferred.
   */
  transfer(to: address, value: NumberLike, tr?: Web3.TransactionRequest): Promise<ITXResult>;

  /**
   * @dev Transfer tokens from one address to another
   * @param from address The address which you want to send tokens from
   * @param to address The address which you want to transfer to
   * @param value uint the amount of tokens to be transferred
   */
  transferFrom(from: address, to: address, value: NumberLike, tr?: Web3.TransactionRequest): Promise<ITXResult>;

  /**
   * Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
   *
   * Beware that changing an allowance with this method brings the risk that someone may use both the old
   * and the new allowance by unfortunate transaction ordering.
   *
   * To change the approve amount you first have to reduce the addresses
   * allowance to zero by calling `approve(spender, 0)` if it is not
   * already 0 to mitigate the race condition described in:
   * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
   *
   * @param spender The address which will spend the funds.
   * @param value The amount of tokens to be spent.
   */
  approve(spender: address, value: NumberLike, tr?: Web3.TransactionRequest): Promise<ITXResult>;

  /**
   * Function to check the amount of tokens that an owner allowed to a spender.
   * @param owner address The address which owns the funds.
   * @param spender address The address which will spend the funds.
   * @return A uint specifying the amount of tokens still available for the spender.
   */
  allowance: {
    call(owner: address, spender: address, tr?: Web3.TransactionRequest): Promise<NumberLike>;
  };
}

/**
 * Not mintable, ERC20 compilant token, distributed by ICO/Pre-ICO.
 */
interface IBaseICOToken extends IBaseFixedERC20Token {

  // Available supply of tokens
  availableSupply: ISimpleCallable<NumberLike>;

  // ICO/Pre-ICO smart contract allowed to distribute public funds for this Token
  ico: ISimpleCallable<address>;

  /**
   * Set address of ICO smart-contract which controls token
   * initial token distribution.
   * @param ico ICO contract address.
   */
  changeICO(ico: address, tr?: Web3.TransactionRequest): Promise<ITXResult>;

  /**
   * Assign `amount` of tokens to investor identified by `to` address.
   * @param to Investor address.
   * @param amount Number of tokens distributed.
   */
  icoInvestment(to: address, amount: NumberLike, tr?: Web3.TransactionRequest): Promise<ITXResult>;
}

/**
 * Mintable, ERC20 compilant token, distributed by ICO/Pre-ICO.
 */
interface IBaseICOMintableToken extends IBaseICOToken {

  /**
   * Mint token
   * @param amount Amount to mint
   */
  mintToken(amount: NumberLike, tr?: Web3.TransactionRequest): Promise<ITXResult>;

  /**
   * Get available tokens for mint
   */
  getAvailableForMint: {
    call(tr?: Web3.TransactionRequest): Promise<NumberLike>;
  };
}

/**
 * ERC20 MCC Token
 */
interface IESRToken extends IBaseICOMintableToken {

  // Token name
  name: ISimpleCallable<string>;

  // Token symbol
  symbol: ISimpleCallable<string>;

  // Token decimals
  decimals: ISimpleCallable<NumberLike>;

  // Reserve reserved tokens is locked
  reservedReserveLocked: ISimpleCallable<boolean>;

  // Switch state of reservedReserveLocked
  toggleReserveLock(tr?:Web3.TransactionRequest): Promise<ITXResult>;

  getReservedTokens: {
    call(side: TokenReservation, tr?: Web3.TransactionRequest): Promise<NumberLike>;
  };

  /**
   * Assign `amount` of privately distributed tokens
   *      to someone identified with `to` address.
   * @param to   Tokens owner
   * @param side Group identifier of privately distributed tokens
   * @param amount Number of tokens distributed
   */
  assignReserved(
    to: address,
    side: TokenReservation,
    amount: NumberLike,
    tr?: Web3.TransactionRequest
  ): Promise<ITXResult>;
}
