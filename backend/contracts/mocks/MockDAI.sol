// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Contrat de simulation DAI pour les tests
/// @dev Hérite d'ERC20 et permet le mint pour les tests
contract MockDAI is ERC20, Ownable {
    constructor() ERC20("DAI Coin", "DAI") Ownable(msg.sender) {
        // Mint 1 milliard de tokens au déploiement (avec 18 décimales)
        _mint(msg.sender, 1_000_000_000 * 10**decimals());
    }

    /// @notice Permet de créer des tokens pour les tests
    /// @param to Adresse recevant les tokens
    /// @param amount Montant à créer
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}