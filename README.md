# Pump.Music - Decentralized Music Royalties Platform

A decentralized marketplace revolutionizing music monetization by enabling musicians and producers to tokenize and trade their music royalties through blockchain technology.

## Overview

Pump.Music is a Web3 platform that allows:
- Musicians and producers to tokenize their royalties into ERC-20 tokens
- Investors to buy, sell, and trade music royalty tokens
- Automated distribution of royalties through smart contracts
- Real-time tracking of music performance and earnings
- Direct fundraising while maintaining artistic independence

## Key Features

- **Royalty Tokenization**: Artists can create tokens representing a percentage of their royalties
- **Smart Contract Integration**: Automated royalty distribution system
- **Secondary Market**: Trade tokens or swap them for USDC
- **Real-time Analytics**: Track token sales and generated royalties
- **Decentralized Architecture**: Built on EVM-compatible chains

## Technical Stack

### Frontend
- React + Vite
- Viem for Ethereum interactions
- Wagmi React Hooks for Web3 functionality
- ESLint for code quality

### Backend
- Blockchain: EVM-compatible L2 (Base)
- Smart Contracts: Solidity
- Development Framework: Hardhat
- Testing Framework: Hardhat Test

## Benefits

### For Musicians
- Financial autonomy from traditional labels
- Immediate monetization of future royalties
- Higher revenue share
- Real-time performance analytics
- Control over their career and work

### For Investors
- Portfolio diversification into music assets
- Participation in artist success
- Token value speculation
- High liquidity through secondary market

## Getting Started

### Prerequisites
- Node.js (v14+ recommended)
- npm or yarn
- An Ethereum wallet (e.g., MetaMask)
- An Infura/Alchemy API key for deployment
- Git

### Backend Setup
1. Clone the repository:
```shell
git clone <repository-url>
cd backend
```

2. Install dependencies:
```shell
npm install
```

3. Create a `.env` file in the backend directory with required credentials

### Development Commands

```shell
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy contracts (local)
npx hardhat run scripts/PumpMusic.js --network localhost

# Deploy contracts (testnet)
npx hardhat run scripts/PumpMusic.js --network baseSepolia
```

## Future Features
- Integration with music streaming APIs (Spotify, Apple Music)
- Real-time royalty distribution
- Advanced performance analytics

## Security
- Comprehensive test coverage
- Gas optimization
- Access control mechanisms
- Regular security audits planned

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT License

Copyright (c) 2024 Pump.Music

## Support

For support and questions, please open an issue in the repository or contact the development team.
