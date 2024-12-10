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

    /// @notice Attribue un SBT à un nouvel artiste pour le vérifier
    /// @dev Seul le propriétaire du contrat peut vérifier les artistes
    /// @param artist L'adresse de l'artiste à vérifier
    function verifyArtist(address artist) external onlyOwner {
        require(!isArtist(artist), "Artist already verified");
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(artist, tokenId);
        emit ArtistVerified(artist, tokenId);
    }

    /// @notice Révoque le statut d'artiste vérifié
    /// @dev Brûle le SBT de l'artiste, supprimant ainsi sa vérification
    /// @param artist L'adresse de l'artiste dont la vérification doit être révoquée
    function revokeVerification(address artist) external onlyOwner {
        require(isArtist(artist), "Not a verified artist");
        uint256 tokenId = tokenOfOwner(artist);
        _burn(tokenId);
        emit VerificationRevoked(artist, tokenId);
    }

    /// @notice Vérifie si une adresse appartient à un artiste vérifié
    /// @dev Un artiste est vérifié s'il possède un SBT (balance > 0)
    /// @param account L'adresse à vérifier
    /// @return bool True si l'adresse appartient à un artiste vérifié
    function isArtist(address account) public view returns (bool) {
        return balanceOf(account) > 0;
    }

    /// @notice Trouve le tokenId associé à un artiste
    /// @dev Parcourt tous les tokens pour trouver celui de l'artiste
    /// @param owner L'adresse de l'artiste
    /// @return uint256 L'ID du token de l'artiste
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

    /// @notice Empêche le transfert des tokens entre adresses, rendant le token "Soulbound"
    /// @dev Surcharge la fonction _update d'OpenZeppelin pour bloquer les transferts
    /// @param to L'adresse de destination du transfert
    /// @param tokenId L'identifiant du token concerné
    /// @param auth L'adresse autorisée pour le transfert
    /// @return address L'adresse du nouveau propriétaire (uniquement pour le mint et burn)
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