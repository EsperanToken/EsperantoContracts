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

  uint public lastStageStartAt = 1554076800; //  2019-04-01T00:00:00.000Z

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
      token.icoForwardRemainToOwner();
      emit ICOCompleted(collectedTokens);
    } else if (!lowCapChecked && block.timestamp >= lastStageStartAt) {
      lowCapChecked = true;
      if (collectedTokens < lowCapTokens) {
        state = State.NotCompleted;
        emit ICONotCompleted();
      }
    } else if (block.timestamp >= endAt) {
        state = State.Completed;
        token.icoForwardRemainToOwner();
        emit ICOCompleted(collectedTokens);
    }
  }

  /**
   * @dev Change ICO bonus 0 stage start date. Can be done only during `Suspended` state.
   * @param lastStageStartAt_ seconds since epoch. Used if it is not zero.
   */
  function tuneLastStageStartAt(uint lastStageStartAt_) onlyOwner isSuspended public {
    if (lastStageStartAt_ > block.timestamp) {
      // New value must be less than current
      require(lastStageStartAt_ < lastStageStartAt);
      lastStageStartAt = lastStageStartAt_;
    }
    touch();
  }

  /**
   * @dev Additional limitations for new endAt value
   */
  function endAtCheck(uint endAt_) internal returns (bool) {
    // New value must be less than current
    return endAt_ < endAt;
  }

  function computeBonus() internal view returns (uint8) {
    if (block.timestamp < 1538352000) { // 2018-10-01T00:00:00.000Z
      return 20;
    } else if (block.timestamp < 1546300800) { // 2019-01-01T00:00:00.000Z
      return 10;
    } else if (block.timestamp < lastStageStartAt) {
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
    uint itokens = token.icoInvestmentWei(msg.sender, amountWei);

    uint bwei = amountWei.mul(bonus).div(100);
    uint btokens = bwei.mul(token.ethTokenExchangeRatio()).div(token.ETH_TOKEN_EXCHANGE_RATIO_MULTIPLIER());
    token.icoAssignReservedBounty(msg.sender, btokens);

    require(collectedTokens + itokens <= hardCapTokens);
    collectedTokens = collectedTokens.add(itokens);
    collectedWei = collectedWei.add(amountWei);

    emit ICOInvestment(msg.sender, amountWei, itokens.add(btokens), bonus);
    forwardFunds();
    touch();
  }
}