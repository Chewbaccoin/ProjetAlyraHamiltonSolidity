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
    mapping(address => PumpMusicRoyaltyToken[]) private _artistTokens;
    
    /// @notice Stores all created tokens
    PumpMusicRoyaltyToken[] private _allTokens;

    event TokenCreated(
        address indexed artist,
        address tokenAddress,
        string name,
        string symbol,
        uint256 royaltyPercentage
    );

    modifier validTokenParameters(
        string memory name,
        string memory symbol,
        uint256 duration,
        uint256 tokenPrice,
        address daiAddress
    ) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(duration > 0, "Duration must be greater than 0");
        require(tokenPrice > 0, "Token price must be greater than 0");
        require(daiAddress != address(0), "Invalid DAI address");
        _;
    }

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
    /// @param daiAddress DAI contract address (18 decimals)
    /// @return address Address of the newly created token
    function createToken(
        string memory name,
        string memory symbol,
        uint256 royaltyPercentage,
        uint256 duration,
        uint256 tokenPrice,
        address daiAddress
    ) external validTokenParameters(name, symbol, duration, tokenPrice, daiAddress) returns (address) {
        // Verify that the caller owns an artist SBT
        // This verification uses the isArtist function from the SBT contract
        require(artistSBT.isArtist(msg.sender), "Only verified artists can create tokens");

        // Create new token
        PumpMusicRoyaltyToken token = new PumpMusicRoyaltyToken(
            name,
            symbol,
            royaltyPercentage,
            duration,
            tokenPrice,
            daiAddress
        );
        
        // Add token to both mappings
        _artistTokens[msg.sender].push(token);
        _allTokens.push(token);
        
        token.transferOwnership(msg.sender);
        
        emit TokenCreated(msg.sender, address(token), name, symbol, royaltyPercentage);
        return address(token);
    }

    /// @notice Retrieves all tokens of an artist
    /// @param artist Artist's address
    /// @return PumpMusicRoyaltyToken[] List of artist's tokens
    function getArtistTokens(address artist) external view returns (PumpMusicRoyaltyToken[] memory) {
        return _artistTokens[artist];
    }

    /// @notice Retrieves all created tokens
    /// @return PumpMusicRoyaltyToken[] List of all tokens
    function getAllTokens() external view returns (PumpMusicRoyaltyToken[] memory) {
        return _allTokens;
    }
}