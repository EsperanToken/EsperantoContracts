pragma solidity 0.4.24;

import "./BaseICOToken.sol";

/**
 * @dev Mintable, ERC20 compliant token, distributed by ICO/Pre-ICO.
 */
contract BaseICOMintableToken is BaseICOToken {

    uint public mintRemain;

    event TokensMinted(uint mintedAmount, uint totalSupply);

    constructor(uint totalSupplyWei_) public BaseICOToken(totalSupplyWei_) {
    }

    /**
    * @dev Mint token.
    * @param mintedAmount_ amount to mint.
    */
    function mintToken(uint mintedAmount_) public onlyOwner {
        mintCheck(mintedAmount_);
        require(mintedAmount_ <= getAvailableForMint());
        totalSupply = totalSupply.add(mintedAmount_);
        mintRemain = mintRemain.sub(mintedAmount_);
        emit TokensMinted(mintedAmount_, totalSupply);
    }

    function getAvailableForMint() public constant returns (uint) {
        return mintRemain;
    }

    function mintCheck(uint) internal;
}
