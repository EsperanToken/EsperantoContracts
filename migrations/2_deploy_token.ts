const ESRToken = artifacts.require('./ESRToken.sol');
export = function(deployer: any) {
  // Set unlimited synchronization timeout
  (<any>ESRToken).constructor.synchronization_timeout = 0;
  // uint ethTokenExchangeRatio_ (multiplied by 1000),
  // uint totalSupplyTokens_,
  // uint teamTokens_,
  // uint bountyTokens_,
  // uint partnersTokens_
  deployer.deploy(ESRToken, '3000000', '120e6', '12e6', '30e6', '18e6');
};