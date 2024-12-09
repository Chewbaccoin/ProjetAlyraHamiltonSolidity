// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

module.exports = {
    solidity: {
        version: "0.8.20",
        coverage: {
          enabled: true,
          // Inclure tous les fichiers de test
          testfiles: ["test/**/*.js", "test/**/*.ts"],
          // Vous pouvez aussi exclure certains fichiers si nécessaire
          skipFiles: ['mocks/', 'interfaces/']
        },
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        hardhat: {
        },
        sepolia: {
            url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [PRIVATE_KEY]
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [PRIVATE_KEY]
        }
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY
    }
};