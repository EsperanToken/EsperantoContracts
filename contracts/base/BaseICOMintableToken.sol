pragma solidity 0.4.24;

import "./BaseICOToken.sol";

/**
 * @dev Mintable, ERC20 compliant token, distributed by ICO/Pre-ICO.
 */
contract BaseICOMintableToken is BaseICOToken {

    event TokensMinted(uint mintedAmount, uint totalSupply);

    constructor(uint totalSupplyWei_) public BaseICOToken(totalSupplyWei_) {
    }

    /**
    * @dev Mint token.
    * @param mintedAmount_ amount to mint.
    */
    function mintToken(uint mintedAmount_) public onlyOwner {
        mintCheck(mintedAmount_);
        totalSupply = totalSupply.add(mintedAmount_);
        balances[owner] = balances[owner].add(mintedAmount_);
        emit TokensMinted(mintedAmount_, totalSupply);
    }

    function mintCheck(uint) internal;
}
