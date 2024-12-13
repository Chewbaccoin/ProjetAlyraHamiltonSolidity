// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockDAI
/// @notice Mock DAI contract for testing purposes
/// @dev Inherits from ERC20 and allows minting for tests
contract MockDAI is ERC20, Ownable {
    constructor() ERC20("DAI Coin", "DAI") Ownable(msg.sender) {
        // Mint 1 billion tokens at deployment (with 18 decimals)
        _mint(msg.sender, 1_000_000_000 * 10**decimals());
    }

    /// @notice Allows creating tokens for testing
    /// @param to Address receiving the tokens
    /// @param amount Amount to create
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}