// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PumpMusicRoyaltyToken.sol";
import "./ArtistSBT.sol";

/// @title PumpMusicTokenFactory
/// @notice Factory for creating new music royalty tokens
/// @dev Enables creation and tracking of tokens by artist
contract PumpMusicTokenFactory is Ownable {
    /// @notice Reference to the artists' SBT contract
    /// @dev Immutable as the address will never change after deployment
    ArtistSBT public immutable artistSBT;
    // Mapping to track tokens created by artist
    mapping(address => PumpMusicRoyaltyToken[]) public artistTokens;
    
    /// @notice Stocke tous les tokens créés
    PumpMusicRoyaltyToken[] public allTokens;

    event TokenCreated(address indexed artist, address tokenAddress);

    constructor(address _artistSBT) Ownable(msg.sender) {
        artistSBT = ArtistSBT(_artistSBT);
    }

    /// @notice Creates a new royalty token
    /// @dev Deploys a new PumpMusicRoyaltyToken contract
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param royaltyPercentage Royalty percentage
    /// @param duration Rights validity duration
    /// @param tokenPrice Initial token price
    /// @param usdcAddress USDC contract address
    /// @return address Address of the newly created token
    function createToken(
        string memory name,
        string memory symbol,
        uint256 royaltyPercentage,
        uint256 duration,
        uint256 tokenPrice,
        address usdcAddress
    ) external returns (address) {
        // Vérifie que l'appelant possède un SBT d'artiste
        // Cette vérification utilise la fonction isArtist du contrat SBT
        require(artistSBT.isArtist(msg.sender), "Only verified artists can create tokens");

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
        
        // Ajouter le token aux deux mappings
        artistTokens[msg.sender].push(token);
        allTokens.push(token);
        
        token.transferOwnership(msg.sender);
        
        emit TokenCreated(msg.sender, address(token));
        return address(token);
    }

    /// @notice Retrieves all tokens of an artist
    /// @param artist Artist's address
    /// @return PumpMusicRoyaltyToken[] List of artist's tokens
    function getArtistTokens(address artist) external view returns (PumpMusicRoyaltyToken[] memory) {
        return artistTokens[artist];
    }

    /// @notice Récupère tous les tokens créés
    /// @return PumpMusicRoyaltyToken[] Liste de tous les tokens
    function getAllTokens() external view returns (PumpMusicRoyaltyToken[] memory) {
        return allTokens;
    }
}