// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

const PRIVATE_KEY_LOCALHOST_HARDHAT = process.env.PRIVATE_KEY_LOCALHOST_HARDHAT || "0000000000000000000000000000000000000000000000000000000000000000";
const PRIVATE_KEY_BASE_SEPOLIA = process.env.PRIVATE_KEY_BASE_SEPOLIA || "0000000000000000000000000000000000000000000000000000000000000000";
const PRIVATE_KEY_BASE_MAINNET = process.env.PRIVATE_KEY_BASE_MAINNET || "0000000000000000000000000000000000000000000000000000000000000000";
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

module.exports = {
    solidity: {
        version: "0.8.20",
        coverage: {
          enabled: true,
          testfiles: ["test/**/*.js", "test/**/*.ts"],
          skipFiles: [
              'mocks/',
              'interfaces/'
          ]
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
        baseSepolia: {
            url: `https://base-sepolia.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [PRIVATE_KEY_BASE_SEPOLIA],
            chainId: 84532,
            verify: {
              etherscan: {
                apiUrl: "https://api-sepolia.basescan.org",
                apiKey: BASESCAN_API_KEY
              }
            }
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [PRIVATE_KEY_BASE_MAINNET],
            verify: {
              etherscan: {
                apiUrl: "https://api.basescan.org",
                apiKey: BASESCAN_API_KEY
              }
            }
        }
    },
    etherscan: {
        apiKey: {
            baseSepolia: BASESCAN_API_KEY
        }
    },
};