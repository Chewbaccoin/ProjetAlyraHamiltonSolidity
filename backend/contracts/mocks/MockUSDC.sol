// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Contrat de simulation USDC pour les tests
/// @dev Hérite d'ERC20 et permet le mint pour les tests
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("USD Coin", "USDC") Ownable(msg.sender) {
        _mint(msg.sender, 1000000000 * 10 ** decimals());
    }

    /// @notice Permet de créer des tokens pour les tests
    /// @param to Adresse recevant les tokens
    /// @param amount Montant à créer
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Override decimals pour matcher USDC
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}