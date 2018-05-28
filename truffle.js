module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 500
    }
  },
  mocha: {
    useColors: true
  },
  networks: {
    development: {
      network_id: '*', // Match any network id
      host: 'localhost',
      port: 8549
    }
  }
};