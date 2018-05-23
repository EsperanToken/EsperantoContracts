pragma solidity 0.4.23;

import "./BaseICOToken.sol";

/**
 * @dev Mintable, ERC20 compliant token, distributed by ICO/Pre-ICO.
 */
contract BaseICOMintableToken is BaseICOToken {

    uint public mintRemain;

    constructor(uint totalSupply_) public BaseICOToken(totalSupply_) {
        setupMint();
    }

    /**
    * @dev Mint token.
    * @param _mintedAmount amount to mint.
    */
    function mintToken(uint _mintedAmount) public onlyOwner {
        setupMint();
        require(_mintedAmount <= getAvailableForMint());
        totalSupply = totalSupply.add(_mintedAmount);
        mintRemain = mintRemain.sub(_mintedAmount);
    }

    function getAvailableForMint() public constant returns (uint) {
        return mintRemain;
    }

    function setupMint() internal;
}
