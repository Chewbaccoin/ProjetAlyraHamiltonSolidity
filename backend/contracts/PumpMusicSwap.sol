// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/// @title PumpMusicSwap
/// @notice Contrat de gestion des échanges de tokens de royalties
/// @dev Implémente un système de pools de liquidité et de swap
contract PumpMusicSwap is Ownable, ReentrancyGuard {
    using Math for uint256;

    /// @notice Structure pour les pools de liquidité
    /// @param tokenReserve Réserve de tokens de royalties
    /// @param usdcReserve Réserve d'USDC
    /// @param isActive État d'activation du pool
    struct LiquidityPool {
        uint256 tokenReserve;
        uint256 usdcReserve;
        bool isActive;
    }

    // Constantes
    uint256 public constant SWAP_FEE = 30; // 0.3% en base points
    
    // Token USDC de référence
    IERC20 public immutable USDC;
    
    // Mapping des pools de liquidité
    mapping(address => LiquidityPool) public liquidityPools;
    
    // Événements
    event LiquidityAdded(address indexed token, uint256 tokenAmount, uint256 usdcAmount);
    event LiquidityRemoved(address indexed token, uint256 tokenAmount, uint256 usdcAmount);
    event TokenSwapped(
        address indexed fromToken,
        address indexed toToken,
        address indexed user,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Constructeur du contrat de swap
    /// @param _usdc Adresse du contrat USDC
    constructor(address _usdc) Ownable(msg.sender) {
        USDC = IERC20(_usdc);
    }

    /// @notice Ajoute de la liquidité à un pool
    /// @param tokenAddress Adresse du token de royalties
    /// @param tokenAmount Montant de tokens à ajouter
    /// @param usdcAmount Montant d'USDC à ajouter
    function addLiquidity(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 usdcAmount
    ) external nonReentrant {
        require(tokenAmount > 0 && usdcAmount > 0, "Amounts must be greater than 0");
        
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        
        // Transfert des tokens
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
        USDC.transferFrom(msg.sender, address(this), usdcAmount);
        
        // Mise à jour du pool
        pool.tokenReserve += tokenAmount;
        pool.usdcReserve += usdcAmount;
        pool.isActive = true;
        
        emit LiquidityAdded(tokenAddress, tokenAmount, usdcAmount);
    }

    /// @notice Retire de la liquidité d'un pool
    /// @dev Permet de retirer un pourcentage de la liquidité fournie
    /// @param tokenAddress Adresse du token de royalties
    /// @param percentage Pourcentage de liquidité à retirer (1-100)
    function removeLiquidity(
        address tokenAddress,
        uint256 percentage
    ) external nonReentrant {
        require(percentage > 0 && percentage <= 100, "Invalid percentage");
        
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        require(pool.isActive, "Pool not active");
        
        // Calcul des montants à retirer
        uint256 tokenAmount = (pool.tokenReserve * percentage) / 100;
        uint256 usdcAmount = (pool.usdcReserve * percentage) / 100;
        
        // Mise à jour du pool
        pool.tokenReserve -= tokenAmount;
        pool.usdcReserve -= usdcAmount;
        
        // Transfert des tokens
        IERC20(tokenAddress).transfer(msg.sender, tokenAmount);
        USDC.transfer(msg.sender, usdcAmount);
        
        emit LiquidityRemoved(tokenAddress, tokenAmount, usdcAmount);
    }

    /// @notice Calcule le montant de sortie pour un swap
    /// @dev Utilise la formule de courbe de liaison constante (x * y = k)
    /// @param amountIn Montant de tokens en entrée
    /// @param reserveIn Réserve du token d'entrée
    /// @param reserveOut Réserve du token de sortie
    /// @return Montant de tokens en sortie
    function getSwapAmount(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0 && reserveIn > 0 && reserveOut > 0, "Invalid amounts");
        
        // Application des frais de 0.3%
        uint256 amountInWithFee = amountIn * (1000 - SWAP_FEE);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        
        return numerator / denominator;
    }

    /// @notice Échange des tokens de royalties contre de l'USDC
    /// @param tokenAddress Adresse du token à échanger
    /// @param tokenAmount Montant de tokens à échanger
    /// @param minUSDCAmount Montant minimum d'USDC attendu
    function swapTokenForUSDC(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 minUSDCAmount
    ) external nonReentrant {
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        require(pool.isActive, "Pool not active");
        
        // Calcul du montant d'USDC à recevoir
        uint256 usdcAmount = getSwapAmount(
            tokenAmount,
            pool.tokenReserve,
            pool.usdcReserve
        );
        require(usdcAmount >= minUSDCAmount, "Insufficient output amount");
        
        // Transferts
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
        USDC.transfer(msg.sender, usdcAmount);
        
        // Mise à jour du pool
        pool.tokenReserve += tokenAmount;
        pool.usdcReserve -= usdcAmount;
        
        emit TokenSwapped(tokenAddress, address(USDC), msg.sender, tokenAmount, usdcAmount);
    }

    /// @notice Échange de l'USDC contre des tokens de royalties
    /// @param tokenAddress Adresse du token à recevoir
    /// @param usdcAmount Montant d'USDC à échanger
    /// @param minTokenAmount Montant minimum de tokens attendu
    function swapUSDCForToken(
        address tokenAddress,
        uint256 usdcAmount,
        uint256 minTokenAmount
    ) external nonReentrant {
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        require(pool.isActive, "Pool not active");
        
        // Calcul du montant de tokens à recevoir
        uint256 tokenAmount = getSwapAmount(
            usdcAmount,
            pool.usdcReserve,
            pool.tokenReserve
        );
        require(tokenAmount >= minTokenAmount, "Insufficient output amount");
        
        // Transferts
        USDC.transferFrom(msg.sender, address(this), usdcAmount);
        IERC20(tokenAddress).transfer(msg.sender, tokenAmount);
        
        // Mise à jour du pool
        pool.usdcReserve += usdcAmount;
        pool.tokenReserve -= tokenAmount;
        
        emit TokenSwapped(address(USDC), tokenAddress, msg.sender, usdcAmount, tokenAmount);
    }

    /// @notice Échange direct entre deux tokens de royalties
    /// @param fromToken Adresse du token à échanger
    /// @param toToken Adresse du token à recevoir
    /// @param fromAmount Montant de tokens à échanger
    /// @param minToAmount Montant minimum de tokens attendu
    function swapTokenForToken(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 minToAmount
    ) external nonReentrant {
        // Premier swap vers USDC
        uint256 usdcAmount = getSwapAmount(
            fromAmount,
            liquidityPools[fromToken].tokenReserve,
            liquidityPools[fromToken].usdcReserve
        );
        
        // Second swap d'USDC vers le token cible
        uint256 toAmount = getSwapAmount(
            usdcAmount,
            liquidityPools[toToken].usdcReserve,
            liquidityPools[toToken].tokenReserve
        );
        
        require(toAmount >= minToAmount, "Insufficient output amount");
        
        // Exécution des transferts
        IERC20(fromToken).transferFrom(msg.sender, address(this), fromAmount);
        IERC20(toToken).transfer(msg.sender, toAmount);
        
        // Mise à jour des pools
        liquidityPools[fromToken].tokenReserve += fromAmount;
        liquidityPools[toToken].tokenReserve -= toAmount;
        
        emit TokenSwapped(fromToken, toToken, msg.sender, fromAmount, toAmount);
    }

    /// @notice Obtient le prix actuel d'un token en USDC
    /// @param tokenAddress Adresse du token
    /// @return Prix du token en USDC (multiplié par 1e18 pour la précision)
    function getTokenPrice(address tokenAddress) external view returns (uint256) {
        LiquidityPool memory pool = liquidityPools[tokenAddress];
        require(pool.isActive && pool.tokenReserve > 0, "Invalid pool");
        return (pool.usdcReserve * 1e18) / pool.tokenReserve;
    }
}