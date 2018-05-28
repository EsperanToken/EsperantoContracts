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

  uint internal ONE_TOKEN = 5e14; // ETH/ESRT 2000

  // --------------- Reserved groups

  uint8 public constant RESERVED_PARTNERS_GROUP = 0x1;

  uint8 public constant RESERVED_TEAM_GROUP = 0x2;

  uint8 public constant RESERVED_BOUNTY_GROUP = 0x4;

  bool public reservedReserveLocked = true;

  /// @dev Fired some tokens distributed to someone from staff,business
  event ReservedTokensDistributed(address indexed to, uint8 group, uint amount);

  /// @dev Token reservation mapping: key(RESERVED_X) => value(number of tokens)
  mapping(uint8 => uint) public reserved;

  constructor(uint totalSupplyTokens_,
              uint teamTokens_,
              uint bountyTokens_,
              uint partnersTokens_)
              public BaseICOMintableToken(totalSupplyTokens_ * ONE_TOKEN) {
    require(availableSupply == totalSupply);
    availableSupply = availableSupply
            .sub(teamTokens_ * ONE_TOKEN)
            .sub(bountyTokens_ * ONE_TOKEN)
            .sub(partnersTokens_ * ONE_TOKEN);
    reserved[RESERVED_TEAM_GROUP] = teamTokens_ * ONE_TOKEN;
    reserved[RESERVED_BOUNTY_GROUP] = bountyTokens_ * ONE_TOKEN;
    reserved[RESERVED_PARTNERS_GROUP] = partnersTokens_ * ONE_TOKEN;
  }

  // Disable direct payments
  function() external payable {
      revert();
  }

  function mintCheck(uint) internal {
  }

  /// @dev Switch state of reservedReserveLocked
  function toggleReserveLock() public onlyOwner {
    reservedReserveLocked = !reservedReserveLocked;
  }

  /**
   * @dev Get reserved tokens for specific group
   */
  function getReservedTokens(uint8 group_) public view returns (uint) {
      return reserved[group_];
  }

  /**
   * @dev Assign `amount_` of privately distributed tokens
   *      to someone identified with `to_` address.
   * @param to_   Tokens owner
   * @param group_ Group identifier of privately distributed tokens
   * @param amount_ Number of tokens distributed with decimals part
   */
  function assignReserved(address to_, uint8 group_, uint amount_) public onlyOwner {
      require(to_ != address(0) && (group_ & 0xF) != 0);
      require(group_ != RESERVED_TEAM_GROUP || (group_ == RESERVED_TEAM_GROUP && !reservedReserveLocked));
      require(group_ != RESERVED_BOUNTY_GROUP || (group_ == RESERVED_BOUNTY_GROUP && !reservedReserveLocked));
      // SafeMath will check reserved[group_] >= amount
      reserved[group_] = reserved[group_].sub(amount_);
      balances[to_] = balances[to_].add(amount_);
      emit ReservedTokensDistributed(to_, group_, amount_);
  }
}
