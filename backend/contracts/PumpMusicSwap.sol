// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/// @title PumpMusicSwap
/// @notice Contract for managing royalty token exchanges
/// @dev Implements a liquidity pool and swap system
contract PumpMusicSwap is Ownable, ReentrancyGuard {
    using Math for uint256;

    /// @notice Structure for liquidity pools
    /// @param tokenReserve Royalty token reserve
    /// @param usdcReserve USDC reserve
    /// @param isActive Pool activation status
    struct LiquidityPool {
        uint256 tokenReserve;
        uint256 usdcReserve;
        bool isActive;
    }

    // CONSTANTS
    uint256 public constant SWAP_FEE = 30; // 0.3% in basis points
    uint256 private constant SCALE_FACTOR = 1e12; // For price calculations
    uint256 private constant BASIS_POINTS = 1000; // For fee calculations
    
    // STATE VARIABLES
    IERC20 public immutable USDC;
    mapping(address => LiquidityPool) public liquidityPools;
    
    // EVENTS
    event LiquidityAdded(address indexed token, uint256 tokenAmount, uint256 usdcAmount);
    event LiquidityRemoved(address indexed token, uint256 tokenAmount, uint256 usdcAmount);
    event TokenSwapped(
        address indexed fromToken,
        address indexed toToken,
        address indexed user,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Contract constructor
    /// @param _usdc USDC contract address
    constructor(address _usdc) Ownable(msg.sender) {
        USDC = IERC20(_usdc);
    }

    // LIQUIDITY MANAGEMENT FUNCTIONS
    /// @notice Adds liquidity to a pool
    /// @param tokenAddress Royalty token address
    /// @param tokenAmount Amount of tokens to add
    /// @param usdcAmount Amount of USDC to add
    function addLiquidity(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 usdcAmount
    ) external nonReentrant {
        require(tokenAmount > 0 && usdcAmount > 0, "Amounts must be greater than 0");
        
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        
        // Transfer tokens
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
        USDC.transferFrom(msg.sender, address(this), usdcAmount);
        
        // Update pool
        pool.tokenReserve += tokenAmount;
        pool.usdcReserve += usdcAmount;
        pool.isActive = true;
        
        emit LiquidityAdded(tokenAddress, tokenAmount, usdcAmount);
    }

    /// @notice Removes liquidity from a pool
    /// @dev Allows withdrawing a percentage of provided liquidity
    /// @param tokenAddress Royalty token address
    /// @param percentage Percentage of liquidity to withdraw (1-100)
    function removeLiquidity(
        address tokenAddress,
        uint256 percentage
    ) external nonReentrant {
        require(percentage > 0 && percentage <= 100, "Invalid percentage");
        
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        require(pool.isActive, "Pool not active");
        
        // Calculate amounts to withdraw
        uint256 tokenAmount = (pool.tokenReserve * percentage) / 100;
        uint256 usdcAmount = (pool.usdcReserve * percentage) / 100;
        
        // Update pool
        pool.tokenReserve -= tokenAmount;
        pool.usdcReserve -= usdcAmount;
        
        // Transfer tokens
        IERC20(tokenAddress).transfer(msg.sender, tokenAmount);
        USDC.transfer(msg.sender, usdcAmount);
        
        emit LiquidityRemoved(tokenAddress, tokenAmount, usdcAmount);
    }

    // SWAP FUNCTIONS
    /// @notice Swaps royalty tokens for USDC
    /// @param tokenAddress Token address to swap
    /// @param tokenAmount Amount of tokens to swap
    /// @param minUSDCAmount Minimum expected USDC amount
    function swapTokenForUSDC(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 minUSDCAmount
    ) external nonReentrant {
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        require(pool.isActive, "Pool not active");
        require(tokenAmount <= pool.tokenReserve, "Insufficient liquidity");
        
        // Calculate USDC amount to receive
        uint256 usdcAmount = getSwapAmount(
            tokenAmount,
            pool.tokenReserve,
            pool.usdcReserve
        );
        require(usdcAmount >= minUSDCAmount, "Insufficient output amount");
        require(usdcAmount <= pool.usdcReserve, "Insufficient liquidity");
        
        // Transfers
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
        USDC.transfer(msg.sender, usdcAmount);
        
        // Update pool
        pool.tokenReserve += tokenAmount;
        pool.usdcReserve -= usdcAmount;
        
        emit TokenSwapped(tokenAddress, address(USDC), msg.sender, tokenAmount, usdcAmount);
    }

    /// @notice Swaps USDC for royalty tokens
    /// @param tokenAddress Token address to receive
    /// @param usdcAmount Amount of USDC to swap
    /// @param minTokenAmount Minimum expected token amount
    function swapUSDCForToken(
        address tokenAddress,
        uint256 usdcAmount,
        uint256 minTokenAmount
    ) external nonReentrant {
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        require(pool.isActive, "Pool not active");
        
        // Calculate token amount to receive
        uint256 tokenAmount = getSwapAmount(
            usdcAmount,
            pool.usdcReserve,
            pool.tokenReserve
        );
        require(tokenAmount >= minTokenAmount, "Insufficient output amount");
        require(tokenAmount <= pool.tokenReserve, "Insufficient liquidity");
        
        // Transfers
        USDC.transferFrom(msg.sender, address(this), usdcAmount);
        IERC20(tokenAddress).transfer(msg.sender, tokenAmount);
        
        // Update pool
        pool.usdcReserve += usdcAmount;
        pool.tokenReserve -= tokenAmount;
        
        emit TokenSwapped(address(USDC), tokenAddress, msg.sender, usdcAmount, tokenAmount);
    }

    /// @notice Direct swap between two royalty tokens
    /// @param fromToken Address of token to swap from
    /// @param toToken Address of token to receive
    /// @param fromAmount Amount of tokens to swap
    /// @param minToAmount Minimum expected token amount
    function swapTokenForToken(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 minToAmount
    ) external nonReentrant {
        LiquidityPool storage fromPool = liquidityPools[fromToken];
        LiquidityPool storage toPool = liquidityPools[toToken];
        
        require(fromPool.isActive && toPool.isActive, "Pool not active");

        // First swap to USDC
        uint256 usdcAmount = getSwapAmount(
            fromAmount,
            fromPool.tokenReserve,
            fromPool.usdcReserve
        );
        
        // Second swap from USDC to target token
        uint256 toAmount = getSwapAmount(
            usdcAmount,
            toPool.usdcReserve,
            toPool.tokenReserve
        );
        
        require(toAmount >= minToAmount, "Insufficient output amount");
        require(toAmount <= toPool.tokenReserve, "Insufficient liquidity");
        
        // Execute transfers
        IERC20(fromToken).transferFrom(msg.sender, address(this), fromAmount);
        IERC20(toToken).transfer(msg.sender, toAmount);
        
        // Update pools
        fromPool.tokenReserve += fromAmount;
        toPool.tokenReserve -= toAmount;
        
        emit TokenSwapped(fromToken, toToken, msg.sender, fromAmount, toAmount);
    }

    // VIEW FUNCTIONS
    /// @notice Gets the current price of a token in USDC
    /// @param tokenAddress Token address
    /// @return Token price in USDC (multiplied by 1e18 for precision)
    function getTokenPrice(address tokenAddress) external view returns (uint256) {
        LiquidityPool memory pool = liquidityPools[tokenAddress];
        require(pool.isActive && pool.tokenReserve > 0, "Invalid pool");
        return (pool.usdcReserve * 1e18 * SCALE_FACTOR) / pool.tokenReserve;
    }

    // INTERNAL FUNCTIONS
    /// @notice Calculates the output amount for a swap
    /// @dev Uses constant product formula (x * y = k)
    /// @param amountIn Input token amount
    /// @param reserveIn Input token reserve
    /// @param reserveOut Output token reserve
    /// @return Output token amount
    function getSwapAmount(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0 && reserveIn > 0 && reserveOut > 0, "Invalid amounts");
        
        uint256 amountInWithFee = amountIn * (BASIS_POINTS - SWAP_FEE);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * BASIS_POINTS) + amountInWithFee;
        
        return numerator / denominator;
    }
}