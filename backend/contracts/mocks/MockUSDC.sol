// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice USDC simulation contract for testing
/// @dev Inherits from ERC20 and allows minting for tests
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("USD Coin", "USDC") Ownable(msg.sender) {
        // Mint 1 billion tokens on deployment (with 6 decimals)
        _mint(msg.sender, 1_000_000_000 * 10**6);
    }

    /// @notice Allows creating tokens for testing
    /// @param to Address receiving the tokens
    /// @param amount Amount to create
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Override decimals to match USDC
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}