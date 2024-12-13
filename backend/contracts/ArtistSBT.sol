// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title ArtistSBT
/// @notice Soulbound Token contract for verified artists
/// @dev A SBT is a non-transferable NFT that certifies artist status
contract ArtistSBT is ERC721Upgradeable, OwnableUpgradeable {
    // Counter to generate unique IDs for each SBT
    uint256 private _tokenIdCounter;
    
    // Events to track artist verification and revocation
    event ArtistVerified(address indexed artist, uint256 tokenId);
    event VerificationRevoked(address indexed artist, uint256 tokenId);

    function initialize() initializer public {
        __ERC721_init("PumpMusic Artist", "ARTIST");
        __Ownable_init(msg.sender);
    }

    /// @notice Assigns an SBT to a new artist for verification
    /// @dev Only the contract owner can verify artists
    /// @param artist The address of the artist to verify
    function verifyArtist(address artist) external onlyOwner {
        require(!isArtist(artist), "Artist already verified");
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(artist, tokenId);
        emit ArtistVerified(artist, tokenId);
    }

    /// @notice Revokes the verified artist status
    /// @dev Burns the artist's SBT, removing their verification
    /// @param artist The address of the artist whose verification should be revoked
    function revokeVerification(address artist) external onlyOwner {
        require(isArtist(artist), "Not a verified artist");
        uint256 tokenId = tokenOfOwner(artist);
        _burn(tokenId);
        emit VerificationRevoked(artist, tokenId);
    }

    /// @notice Checks if an address belongs to a verified artist
    /// @dev An artist is verified if they own an SBT (balance > 0)
    /// @param account The address to check
    /// @return bool True if the address belongs to a verified artist
    function isArtist(address account) public view returns (bool) {
        return balanceOf(account) > 0;
    }

    /// @notice Finds the tokenId associated with an artist
    /// @dev Iterates through all tokens to find the artist's token
    /// @param owner The artist's address
    /// @return uint256 The artist's token ID
    function tokenOfOwner(address owner) public view returns (uint256) {
        require(isArtist(owner), "Not a verified artist");
        for (uint256 i = 0; i < _tokenIdCounter; i++) {
            try this.ownerOf(i) returns (address tokenOwner) {
                if (tokenOwner == owner) {
                    return i;
                }
            } catch {
                continue;
            }
        }
        revert("Token not found");
    }

    /// @notice Prevents token transfers between addresses, making it "Soulbound"
    /// @dev Overrides OpenZeppelin's _update function to block transfers
    /// @param to The destination address for the transfer
    /// @param tokenId The ID of the token concerned
    /// @param auth The authorized address for the transfer
    /// @return address The address of the new owner (only for minting and burning)
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("SBT: transfer not allowed");
        }
        return super._update(to, tokenId, auth);
    }
} 