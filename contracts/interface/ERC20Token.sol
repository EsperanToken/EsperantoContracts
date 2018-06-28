pragma solidity 0.4.24;


interface ERC20Token {
    function transferFrom(address from_, address to_, uint value_) external returns (bool);
}
