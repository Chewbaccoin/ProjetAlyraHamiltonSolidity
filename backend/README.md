# Pump.Music - Decentralized Music Royalty Platform

Pump.Music is a decentralized platform revolutionizing music monetization by enabling artists and producers to tokenize their royalties through blockchain technology.

## Project Overview

Pump.Music allows artists to:
- Create ERC-20 tokens representing a percentage of their future royalties
- Raise funds directly from investors while maintaining independence
- Automate royalty distribution through smart contracts
- Track performance and revenue in real-time

### MVP Scope
The current MVP implementation focuses on:
- ERC-20 token creation for artists (representing royalty shares)
- Simulated royalty distribution system
- Primary market for token sales
- Secondary market for token swaps
- Basic user interface for token creation and purchase

### Future Features
- Integration with music streaming APIs (Spotify, Apple Music)
- Real-time royalty distribution
- Advanced performance analytics

## Technical Stack

- **Blockchain**: EVM-compatible L2 (Base)
- **Smart Contracts**: Solidity
- **Development Framework**: Hardhat
- **Frontend Integration**: React.js / Viem / Wagmi

## Prerequisites

- Node.js (v14+ recommended)
- npm or yarn
- An Ethereum wallet (e.g., MetaMask)
- An Infura/Alchemy API key for deployment
- Git

## Setup

1. Clone the repository:
```shell
git clone <repository-url>
cd backend
```

2. Install dependencies:
```shell
npm install
```

3. Create a `.env` file in the backend directory:
```shell
PRIVATE_KEY_LOCALHOST_HARDHAT=your_wallet_private_key
PRIVATE_KEY_BASE_SEPOLIA=your_wallet_private_key
INFURA_API_KEY=your_infura_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Development Commands

```shell
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test

# Generate test coverage
npx hardhat coverage

# Start local Hardhat node
npx hardhat node

# Deploy contracts
# Local development:
npx hardhat run scripts/PumpMusic.js --network localhost

# Base Sepolia testnet:
npx hardhat run scripts/PumpMusic.js --network baseSepolia
```

## Project Structure

```
├── artifacts
├── cache
├── contracts
│   ├── ArtistSBT.sol
│   ├── LPToken.sol
│   ├── mocks
│   │   ├── MockDAI.sol
│   │   ├── MockToken.sol
│   │   └── MockUSDC.sol
│   ├── PumpMusicRoyaltyToken.sol
│   ├── PumpMusicSwap.sol
│   └── PumpMusicTokenFactory.sol
├── coverage
├── node_modules
├── scripts
│   └── PumpMusic.js
└── test
    ├── ArtistSBT.test.js
    ├── LPToken.test.js
    ├── MockDAI.test.js
    ├── MockUSDC.test.js
    ├── PumpMusicRoyaltyToken.test.js
    ├── PumpMusicSwap.test.js
    └── PumpMusicTokenFactory.test.js
```

## Testing

The project includes comprehensive tests for all smart contract functionality:

- Unit tests for individual contract functions
- Integration tests for contract interactions
- Gas optimization tests

Run the test suite:
```shell
npx hardhat test
```

Generate coverage report:
```shell
npx hardhat coverage
```

## Deployment

1. Configure your deployment network in `hardhat.config.js`
2. Ensure your `.env` file contains the necessary credentials
3. Deploy using the appropriate network command:
```shell
npx hardhat run scripts/PumpMusic.js --network <network-name>
```

### Supported Networks
- Localhost (Hardhat Network)
- Base Sepolia (Testnet)
- Base (Mainnet) - Coming soon

## Security

- All contracts are thoroughly tested
- Gas optimization implemented
- Access control mechanisms in place
- Regular security audits planned

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the repository or contact the development team.
