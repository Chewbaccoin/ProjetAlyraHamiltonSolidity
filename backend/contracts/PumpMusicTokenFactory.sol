// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PumpMusicRoyaltyToken.sol";

/// @title PumpMusicTokenFactory
/// @notice Factory pour créer de nouveaux tokens de royalties musicales
/// @dev Permet la création et le suivi des tokens par artiste
contract PumpMusicTokenFactory is Ownable {
    // Mapping pour suivre les tokens créés par artiste
    mapping(address => PumpMusicRoyaltyToken[]) public artistTokens;
    
    event TokenCreated(address indexed artist, address tokenAddress);

    constructor() Ownable(msg.sender) {}

    /// @notice Crée un nouveau token de royalties
    /// @dev Déploie un nouveau contrat PumpMusicRoyaltyToken
    /// @param name Nom du token
    /// @param symbol Symbole du token
    /// @param royaltyPercentage Pourcentage des royalties
    /// @param duration Durée de validité des droits
    /// @param tokenPrice Prix initial du token
    /// @param usdcAddress Adresse du contrat USDC
    /// @return address Adresse du nouveau token créé
    function createToken(
        string memory name,
        string memory symbol,
        uint256 royaltyPercentage,
        uint256 duration,
        uint256 tokenPrice,
        address usdcAddress
    ) external returns (address) {
        // Validation des paramètres
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(duration > 0, "Duration must be greater than 0");
        require(tokenPrice > 0, "Token price must be greater than 0");
        require(usdcAddress != address(0), "Invalid USDC address");

        // Création du nouveau token
        PumpMusicRoyaltyToken token = new PumpMusicRoyaltyToken(
            name,
            symbol,
            royaltyPercentage,
            duration,
            tokenPrice,
            usdcAddress
        );
        
        // Enregistrement et transfert de propriété
        artistTokens[msg.sender].push(token);
        token.transferOwnership(msg.sender);
        
        emit TokenCreated(msg.sender, address(token));
        return address(token);
    }

    /// @notice Récupère tous les tokens d'un artiste
    /// @param artist Adresse de l'artiste
    /// @return PumpMusicRoyaltyToken[] Liste des tokens de l'artiste
    function getArtistTokens(address artist) external view returns (PumpMusicRoyaltyToken[] memory) {
        return artistTokens[artist];
    }
}