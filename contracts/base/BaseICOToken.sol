pragma solidity 0.4.24;

import "../commons/SafeMath.sol";
import "./BaseFixedERC20Token.sol";

/**
 * @dev Not mintable, ERC20 compliant token, distributed by ICO/Pre-ICO.
 */
contract BaseICOToken is BaseFixedERC20Token {

    /// @dev Available supply of tokens
    uint public availableSupply;

    /// @dev ICO/Pre-ICO smart contract allowed to distribute public funds for this
    address public ico;

    /// @dev Token/ETH exchange ratio
    uint public ethTokenExchangeRatio;

    /// @dev Fired if investment for `amount` of tokens performed by `to` address
    event ICOTokensInvested(address indexed to, uint amount);

    /// @dev ICO contract changed for this token
    event ICOChanged(address indexed icoContract);

    modifier onlyICO() {
        require(msg.sender == ico);
        _;
    }

    /**
     * @dev Not mintable, ERC20 compliant token, distributed by ICO/Pre-ICO.
     * @param totalSupply_ Total tokens supply.
     */
    constructor(uint totalSupply_) public {
        locked = true;
        totalSupply = totalSupply_;
        availableSupply = totalSupply_;
    }

    /**
     * @dev Set address of ICO smart-contract which controls token
     * initial token distribution.
     * @param ico_ ICO contract address.
     */
    function changeICO(address ico_) public onlyOwner {
        ico = ico_;
        emit ICOChanged(ico);
    }

    function isValidICOInvestment(address to_, uint amount_) internal view returns (bool) {
        return to_ != address(0) && amount_ <= availableSupply;
    }

    /**
     * @dev Assign `amountWei_` of wei converted into tokens to investor identified by `to_` address.
     * @param to_ Investor address.
     * @param amountWei_ Number of wei invested
     * @return Amount of invested tokens
     */
    function icoInvestmentWei(address to_, uint amountWei_) public returns (uint);

    /**
     * @dev Assign `amount_` of privately distributed tokens from bounty group
     *      to someone identified with `to_` address.
     * @param to_   Tokens owner
     * @param amount_ Number of tokens distributed with decimals part
     */
    function icoAssignReservedBounty(address to_, uint amount_) public;
}