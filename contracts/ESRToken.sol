pragma solidity 0.4.24;

import "./commons/SafeMath.sol";
import "./base/BaseICOMintableToken.sol";

/**
 * Esperanto Token
 */
contract ESRToken is BaseICOMintableToken {
  using SafeMath for uint;

  string public constant name = "EsperantoToken";

  string public constant symbol = "ESRT";

  uint8 public constant decimals = 18;

  // --------------- Reserved groups

  uint8 public constant RESERVED_PARTNERS_GROUP = 0x1;

  uint8 public constant RESERVED_TEAM_GROUP = 0x2;

  uint8 public constant RESERVED_BOUNTY_GROUP = 0x4;

  uint internal ONE_TOKEN = 1e18; // 1e18 / ESRT = 1

  /// @dev Fired some tokens distributed to someone from staff,business
  event ReservedTokensDistributed(address indexed to, uint8 group, uint amount);

  /// @dev Fired if token exchange ratio updated
  event EthTokenExchangeRatioUpdated(uint ethTokenExchangeRatio);

  /// @dev Token sell event
  event SellToken(address indexed to, uint amount, uint bonusAmount);

  /// @dev Token reservation mapping: key(RESERVED_X) => value(number of tokens)
  mapping(uint8 => uint) public reserved;

  constructor(uint ethTokenExchangeRatio_,
              uint totalSupplyTokens_,
              uint teamTokens_,
              uint bountyTokens_,
              uint partnersTokens_) public BaseICOMintableToken(totalSupplyTokens_ * ONE_TOKEN) {
    require(availableSupply == totalSupply);
    ethTokenExchangeRatio = ethTokenExchangeRatio_;
    availableSupply = availableSupply
            .sub(teamTokens_ * ONE_TOKEN)
            .sub(bountyTokens_ * ONE_TOKEN)
            .sub(partnersTokens_ * ONE_TOKEN);
    reserved[RESERVED_TEAM_GROUP] = teamTokens_ * ONE_TOKEN;
    reserved[RESERVED_BOUNTY_GROUP] = bountyTokens_ * ONE_TOKEN;
    reserved[RESERVED_PARTNERS_GROUP] = partnersTokens_ * ONE_TOKEN;
  }

  function mintCheck(uint) internal {
    // Token not mintable until: 2020-06-01T00:00:00.000Z
    require(block.timestamp >= 1590969600);
  }

  modifier preLockUnlock() {
    // Token transfers locked until: 2019-10-01T00:00:00.000Z
    require(block.timestamp >= 1569888000);
    _;
  }

  // Disable direct payments
  function() external payable {
    revert();
  }

  /**
   * @dev Get reserved tokens for specific group
   */
  function getReservedTokens(uint8 group_) public view returns (uint) {
      return reserved[group_];
  }

  /**
   * @dev Assign `amount_` of privately distributed tokens from bounty group
   *      to someone identified with `to_` address.
   * @param to_   Tokens owner
   * @param amount_ Number of tokens distributed with decimals part
   */
  function icoAssignReservedBounty(address to_, uint amount_) public onlyICO {
    assignReservedTokens(to_, RESERVED_BOUNTY_GROUP, amount_);
  }

  /**
   * @dev Assign `amount_` of privately distributed tokens
   *      to someone identified with `to_` address.
   * @param to_   Tokens owner
   * @param group_ Group identifier of privately distributed tokens
   * @param amount_ Number of tokens distributed with decimals part
   */
  function assignReserved(address to_, uint8 group_, uint amount_) public onlyOwner {
      assignReservedTokens(to_, group_, amount_);
  }

  /**
   * @dev Assign `amount_` of privately distributed tokens
   *      to someone identified with `to_` address.
   * @param to_   Tokens owner
   * @param group_ Group identifier of privately distributed tokens
   * @param amount_ Number of tokens distributed with decimals part
   */
  function assignReservedTokens(address to_, uint8 group_, uint amount_) internal {
      require(to_ != address(0) && (group_ & 0x7) != 0);
      // SafeMath will check reserved[group_] >= amount
      reserved[group_] = reserved[group_].sub(amount_);
      balances[to_] = balances[to_].add(amount_);
      emit ReservedTokensDistributed(to_, group_, amount_);
  }

  /**
   * @dev Update ETH/Token
   */
  function updateTokenExchangeRatio(uint ethTokenExchangeRatio_) public onlyOwner {
    ethTokenExchangeRatio = ethTokenExchangeRatio_;
    emit EthTokenExchangeRatioUpdated(ethTokenExchangeRatio);
  }


  /**
   * @dev Register token sell
   */
  function sellToken(address to_, uint amount, uint bonusAmount) public onlyOwner returns (uint)  {
    require(to_ != address(0) && amount <= availableSupply);
    availableSupply = availableSupply.sub(amount);
    balances[to_] = balances[to_].add(amount);
    assignReservedTokens(to_, RESERVED_BOUNTY_GROUP, bonusAmount);
    emit SellToken(to_, amount, bonusAmount);
    return amount;
  }

  /**
   * @dev Assign `amountWei_` of wei converted into tokens to investor identified by `to_` address.
   * @param to_ Investor address.
   * @param amountWei_ Number of wei invested
   * @return Amount of invested tokens
   */
  function icoInvestmentWei(address to_, uint amountWei_) public onlyICO returns (uint) {
    uint amount = amountWei_ * ethTokenExchangeRatio;
    require(isValidICOInvestment(to_, amount));
    availableSupply = availableSupply.sub(amount);
    balances[to_] = balances[to_].add(amount);
    emit ICOTokensInvested(to_, amount);
    return amount;
  }
}
