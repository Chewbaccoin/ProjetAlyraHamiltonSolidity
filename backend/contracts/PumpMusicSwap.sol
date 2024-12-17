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
    /// @param daiReserve DAI reserve
    /// @param isActive Pool activation status
    struct LiquidityPool {
        uint256 tokenReserve;
        uint256 daiReserve;
        bool isActive;
    }

    // CONSTANTS
    uint256 public constant SWAP_FEE = 30; // 0.3% in basis points
    uint256 private constant SCALE_FACTOR = 1e12; // For price calculations
    uint256 private constant BASIS_POINTS = 1000; // For fee calculations
    
    // STATE VARIABLES
    IERC20 public immutable DAI;
    mapping(address => LiquidityPool) public liquidityPools;
    
    // EVENTS
    event LiquidityAdded(address indexed token, uint256 tokenAmount, uint256 daiAmount);
    event LiquidityRemoved(address indexed token, uint256 tokenAmount, uint256 daiAmount);
    event TokenSwapped(
        address indexed fromToken,
        address indexed toToken,
        address indexed user,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Contract constructor
    /// @param _dai DAI contract address
    constructor(address _dai) Ownable(msg.sender) {
        DAI = IERC20(_dai);
    }

    /// @notice Adds liquidity to a pool
    /// @param tokenAddress Royalty token address
    /// @param tokenAmount Amount of tokens to add
    /// @param daiAmount Amount of DAI to add
    function addLiquidity(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 daiAmount
    ) external nonReentrant {
        require(tokenAmount > 0 && daiAmount > 0, "Amounts must be greater than 0");
        
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        
        // Transfer tokens
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
        DAI.transferFrom(msg.sender, address(this), daiAmount);
        
        // Update pool
        pool.tokenReserve += tokenAmount;
        pool.daiReserve += daiAmount;
        pool.isActive = true;
        
        emit LiquidityAdded(tokenAddress, tokenAmount, daiAmount);
    }

    /// @notice Removes liquidity from a pool
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
        uint256 daiAmount = (pool.daiReserve * percentage) / 100;
        
        // Update pool
        pool.tokenReserve -= tokenAmount;
        pool.daiReserve -= daiAmount;
        
        // Transfer tokens
        IERC20(tokenAddress).transfer(msg.sender, tokenAmount);
        DAI.transfer(msg.sender, daiAmount);
        
        emit LiquidityRemoved(tokenAddress, tokenAmount, daiAmount);
    }

    /// @notice Swaps royalty tokens for DAI
    /// @param tokenAddress Token address to swap
    /// @param tokenAmount Amount of tokens to swap
    /// @param minDaiAmount Minimum expected DAI amount
    function swapTokenForDAI(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 minDaiAmount
    ) external nonReentrant {
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        require(pool.isActive, "Pool not active");
        require(tokenAmount <= pool.tokenReserve, "Insufficient liquidity");
        
        uint256 daiAmount = getSwapAmount(
            tokenAmount,
            pool.tokenReserve,
            pool.daiReserve
        );
        require(daiAmount >= minDaiAmount, "Insufficient output amount");
        require(daiAmount <= pool.daiReserve, "Insufficient liquidity");
        
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
        DAI.transfer(msg.sender, daiAmount);
        
        pool.tokenReserve += tokenAmount;
        pool.daiReserve -= daiAmount;
        
        emit TokenSwapped(tokenAddress, address(DAI), msg.sender, tokenAmount, daiAmount);
    }

    /// @notice Swaps DAI for royalty tokens
    /// @param tokenAddress Token address to receive
    /// @param daiAmount Amount of DAI to swap
    /// @param minTokenAmount Minimum expected token amount
    function swapDAIForToken(
        address tokenAddress,
        uint256 daiAmount,
        uint256 minTokenAmount
    ) external nonReentrant {
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        require(pool.isActive, "Pool not active");
        
        uint256 tokenAmount = getSwapAmount(
            daiAmount,
            pool.daiReserve,
            pool.tokenReserve
        );
        require(tokenAmount >= minTokenAmount, "Insufficient output amount");
        require(tokenAmount <= pool.tokenReserve, "Insufficient liquidity");
        
        DAI.transferFrom(msg.sender, address(this), daiAmount);
        IERC20(tokenAddress).transfer(msg.sender, tokenAmount);
        
        pool.daiReserve += daiAmount;
        pool.tokenReserve -= tokenAmount;
        
        emit TokenSwapped(address(DAI), tokenAddress, msg.sender, daiAmount, tokenAmount);
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

        uint256 daiAmount = getSwapAmount(
            fromAmount,
            fromPool.tokenReserve,
            fromPool.daiReserve
        );
        
        uint256 toAmount = getSwapAmount(
            daiAmount,
            toPool.daiReserve,
            toPool.tokenReserve
        );
        
        require(toAmount >= minToAmount, "Insufficient output amount");
        require(toAmount <= toPool.tokenReserve, "Insufficient liquidity");
        
        IERC20(fromToken).transferFrom(msg.sender, address(this), fromAmount);
        IERC20(toToken).transfer(msg.sender, toAmount);
        
        fromPool.tokenReserve += fromAmount;
        toPool.tokenReserve -= toAmount;
        
        emit TokenSwapped(fromToken, toToken, msg.sender, fromAmount, toAmount);
    }

    /// @notice Gets the current price of a token in DAI
    /// @param tokenAddress Token address
    /// @return Token price in DAI (multiplied by 1e18 for precision)
    function getTokenPrice(address tokenAddress) external view returns (uint256) {
        LiquidityPool memory pool = liquidityPools[tokenAddress];
        require(pool.isActive && pool.tokenReserve > 0, "Invalid pool");
        return (pool.daiReserve * 1e18) / pool.tokenReserve;
    }

    /// @notice Calculates the output amount for a swap
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