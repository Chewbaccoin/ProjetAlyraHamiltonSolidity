// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


/// @title PumpMusicRoyaltyToken
/// @notice Main contract for music royalty token management
/// @dev Inherits from ERC20 for token functionality, Ownable for rights management,
///      and ReentrancyGuard for security
contract PumpMusicRoyaltyToken is ERC20, Ownable, ReentrancyGuard {
    /// @notice Structure containing royalty information
    /// @param expirationDate End date of royalty rights
    /// @param royaltyPercentage Percentage of royalties represented by the token (in basis points)
    /// @param totalRoyalties Total amount of undistributed royalties
    struct RoyaltyInfo {
        uint256 expirationDate;
        uint256 royaltyPercentage;
        uint256 totalRoyalties;
    }

    // Variables d'état
    RoyaltyInfo public royaltyInfo;
    uint256 public constant PLATFORM_FEE = 300; // 3% en base points
    uint256 public tokenPrice;                  // Prix du token en USDC
    IERC20 public usdcToken;                   // Référence au contrat USDC
    bool public isListedForSale;               // État de mise en vente des tokens
    
    // Mapping pour suivre les dernières réclamations de royalties
    mapping(address => uint256) public lastClaimTime;

    // Événements
    event RoyaltyReceived(uint256 amount, uint256 platformFee);
    event RoyaltyClaimed(address indexed holder, uint256 amount);
    event TokensListed(uint256 price);
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 price);

    /// @notice Constructeur du contrat
    /// @dev Initialise le token avec ses paramètres de base
    /// @param name Nom du token
    /// @param symbol Symbole du token
    /// @param _royaltyPercentage Pourcentage des royalties (en base points)
    /// @param _duration Durée de validité des droits en secondes
    /// @param _tokenPrice Prix initial du token en USDC
    /// @param _usdcAddress Adresse du contrat USDC
    constructor(
        string memory name,
        string memory symbol,
        uint256 _royaltyPercentage,
        uint256 _duration,
        uint256 _tokenPrice,
        address _usdcAddress
    ) ERC20(name, symbol) Ownable(msg.sender) {
        royaltyInfo.royaltyPercentage = _royaltyPercentage;
        royaltyInfo.expirationDate = block.timestamp + _duration;
        tokenPrice = _tokenPrice;
        usdcToken = IERC20(_usdcAddress);
        _mint(msg.sender, 1_000_000_000 * 10**decimals()); // 1 milliard de tokens
    }

    /// @notice Distribue les royalties reçues
    /// @dev Prélève les frais de plateforme et met à jour le montant total des royalties
    /// @param amount Montant des royalties à distribuer
    function distributeRoyalties(uint256 amount) external nonReentrant {
        require(block.timestamp < royaltyInfo.expirationDate, "Royalty period expired");
        
        // Calcul des frais de plateforme
        uint256 platformFeeAmount = (amount * PLATFORM_FEE) / 10000;
        uint256 netAmount = amount - platformFeeAmount;
        
        // Mise à jour des royalties totales
        royaltyInfo.totalRoyalties += netAmount;
        emit RoyaltyReceived(amount, platformFeeAmount);
        
        // Transfert des frais à la plateforme
        (bool success, ) = payable(owner()).call{value: platformFeeAmount}("");
        require(success, "Platform fee transfer failed");
    }

    /// @notice Permet aux détenteurs de réclamer leurs royalties
    /// @dev Calcule et transfère la part de royalties en fonction des tokens détenus
    function claimRoyalties() external nonReentrant {
        require(balanceOf(msg.sender) > 0, "No tokens owned");
        require(royaltyInfo.totalRoyalties > 0, "No royalties to claim");
        
        // Modification du calcul pour éviter la perte de précision
        uint256 userBalance = balanceOf(msg.sender);
        uint256 supply = totalSupply();
        // Calculer d'abord le pourcentage puis multiplier par le montant total
        uint256 share = (userBalance * 1e18 / supply) * royaltyInfo.totalRoyalties / 1e18;
        require(share > 0, "Share too small");
        
        royaltyInfo.totalRoyalties -= share;
        lastClaimTime[msg.sender] = block.timestamp;
        
        (bool success, ) = payable(msg.sender).call{value: share}("");
        require(success, "Transfer failed");
        
        emit RoyaltyClaimed(msg.sender, share);
    }

    /// @notice Liste les tokens pour la vente
    /// @dev Uniquement appelable par le propriétaire
    /// @param _price Prix de vente en USDC
    function listTokensForSale(uint256 _price) external onlyOwner {
        require(_price > 0, "Price must be greater than 0");
        tokenPrice = _price;
        isListedForSale = true;
        emit TokensListed(_price);
    }

    /// @notice Permet l'achat de tokens
    /// @dev Transfère les USDC au vendeur et les tokens à l'acheteur
    /// @param amount Nombre de tokens à acheter
    function purchaseTokens(uint256 amount) external nonReentrant {
        require(isListedForSale, "Tokens not listed for sale");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 cost = amount * tokenPrice;
        require(cost > 0, "Invalid cost calculation");
        
        // Vérifier le solde USDC de l'acheteur
        uint256 buyerBalance = usdcToken.balanceOf(msg.sender);
        require(buyerBalance >= cost, "Insufficient USDC balance");
        
        // Vérifier l'allowance USDC
        uint256 allowance = usdcToken.allowance(msg.sender, address(this));
        require(allowance >= cost, "Insufficient USDC allowance");
        
        require(usdcToken.transferFrom(msg.sender, owner(), cost), "USDC transfer failed");
        
        _transfer(owner(), msg.sender, amount);
        emit TokensPurchased(msg.sender, amount, cost);
    }

    /// @notice Vérifie si la période de royalties est toujours active
    /// @return bool Indique si la période est active
    function isRoyaltyPeriodActive() public view returns (bool) {
        return block.timestamp < royaltyInfo.expirationDate;
    }

    receive() external payable {
        // Permet au contrat de recevoir de l'ETH
    }
}