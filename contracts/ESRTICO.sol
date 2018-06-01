pragma solidity 0.4.24;

import "./commons/SafeMath.sol";
import "./base/BaseICO.sol";

contract ESRTICO is BaseICO {
  using SafeMath for uint;

  /// @dev Total number of invested wei
  uint public collectedWei;

  /// @dev Total number of assigned tokens
  uint public collectedTokens;

  bool internal lowCapChecked = false;

  constructor(address icoToken_,
              address teamWallet_) public {
    require(icoToken_ != address(0) && teamWallet_ != address(0));
    token = BaseICOToken(icoToken_);
    teamWallet = teamWallet_;
    hardCapTokens = 60e24; // 60M Tokens
    lowCapTokens = 15e23;  // 1.5M Tokens
    hardCapTxWei = 1e30;  // practically infinite
    lowCapTxWei = 5e16;   // 0.05 ETH
  }

  /**
   * Accept direct payments
   */
  function() external payable {
    buyTokens();
  }

  /**
   * @dev Recalculate ICO state based on current block time.
   * Should be called periodically by ICO owner.
   */
  function touch() public {
    if (state != State.Active && state != State.Suspended) {
      return;
    }
    if (collectedTokens >= hardCapTokens) {
      state = State.Completed;
      endAt = block.timestamp;
      emit ICOCompleted(collectedTokens);
    } else if (!lowCapChecked && block.timestamp >= 1554076800) { //  2019-04-01T00:00:00.000Z
      lowCapChecked = true;
      if (collectedTokens < lowCapTokens) {
        state = State.NotCompleted;
        emit ICONotCompleted();
      }
    } else if (block.timestamp >= endAt) {
        state = State.Completed;
        emit ICOCompleted(collectedTokens);
    }
  }

  function computeBonus() internal view returns (uint8) {
    if (block.timestamp < 1538352000) { // 2018-10-01T00:00:00.000Z
      return 20;
    } else if (block.timestamp < 1546300800) { // 2019-01-01T00:00:00.000Z
      return 10;
    } else if (block.timestamp < 1554076800) { // 2019-04-01T00:00:00.000Z
      return 5;
    } else {
      return 0;
    }
  }

  function buyTokens() public payable {

    require(state == State.Active &&
            block.timestamp < endAt &&
            msg.value >= lowCapTxWei &&
            msg.value <= hardCapTxWei &&
            whitelisted(msg.sender));

    uint8 bonus = computeBonus();
    uint amountWei = msg.value;
    uint iwei = amountWei.mul(100 + bonus).div(100);
    uint itokens = token.icoInvestmentWei(msg.sender, iwei);

    require(collectedTokens + itokens <= hardCapTokens);
    collectedTokens = collectedTokens.add(itokens);
    collectedWei = collectedWei.add(amountWei);

    emit ICOInvestment(msg.sender, amountWei, itokens, bonus);
    forwardFunds();
    touch();
  }
}