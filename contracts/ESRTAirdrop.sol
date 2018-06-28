pragma solidity 0.4.24;

import "./base/BaseAirdrop.sol";


/**
 * @title ESRT token airdrop contract.
 */
contract ESRTAirdrop is BaseAirdrop {

    constructor(address _token, address _tokenHolder) public BaseAirdrop(_token, _tokenHolder) {
        locked = true;
    }

    // Disable direct payments
    function() external payable {
        revert();
    }
}