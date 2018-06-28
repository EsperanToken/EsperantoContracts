pragma solidity 0.4.24;

import "../commons/SafeMath.sol";
import "../flavours/Lockable.sol";
import "../interface/ERC20Token.sol";


contract BaseAirdrop is Lockable {
    using SafeMath for uint;

    ERC20Token public token;

    address public tokenHolder;

    mapping(address => bool) public users;

    event AirdropToken(address indexed to, uint amount);

    constructor(address _token, address _tokenHolder) public {
        require(_token != address(0) && _tokenHolder != address(0));
        token = ERC20Token(_token);
        tokenHolder = _tokenHolder;
    }

    function airdrop(uint8 v, bytes32 r, bytes32 s, uint amount) public whenNotLocked {
        if (users[msg.sender] ||
            ecrecover(
                keccak256(
                    abi.encodePacked(
                        "Signed for Airdrop",
                        address(this),
                        address(token),
                        msg.sender,
                        amount
                    )
                ), v, r, s) != owner) {
            revert();
        }
        users[msg.sender] = true;
        token.transferFrom(tokenHolder, msg.sender, amount);
        emit AirdropToken(msg.sender, amount);
    }

    function getAirdropStatus(address user) public constant returns (bool success) {
        return users[user];
    }
}
