// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./LPToken.sol";

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
    mapping(address => IERC20) public lpTokens;
    address[] public allLPTokens;
    
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
    event LPTokenDeployed(address indexed token, address indexed lpToken);

    // Add this line near the top of your PumpMusicSwap contract, with other error definitions
    error InvalidPercentage();

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
        
        // Get or create LP token
        IERC20 lpToken = lpTokens[tokenAddress];
        if (address(lpToken) == address(0)) {
            lpToken = createLPToken(tokenAddress);
        }

        // Calculate LP tokens to mint
        uint256 lpTokensToMint;
        if (pool.tokenReserve == 0) {
            lpTokensToMint = Math.sqrt(tokenAmount * daiAmount);
        } else {
            uint256 lpTokenSupply = lpToken.totalSupply();
            lpTokensToMint = Math.min(
                (tokenAmount * lpTokenSupply) / pool.tokenReserve,
                (daiAmount * lpTokenSupply) / pool.daiReserve
            );
        }
        
        // Transfer tokens
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
        DAI.transferFrom(msg.sender, address(this), daiAmount);
        
        // Update pool
        pool.tokenReserve += tokenAmount;
        pool.daiReserve += daiAmount;
        pool.isActive = true;
        
        // Mint LP tokens
        LPToken(address(lpToken)).mint(msg.sender, lpTokensToMint);
        
        emit LiquidityAdded(tokenAddress, tokenAmount, daiAmount);
    }

    /// @notice Removes liquidity from a pool
    /// @param tokenAddress Royalty token address
    /// @param lpTokenAmount Amount of LP tokens to withdraw
    function removeLiquidity(
        address tokenAddress,
        uint256 lpTokenAmount
    ) external nonReentrant {
        LiquidityPool storage pool = liquidityPools[tokenAddress];
        require(pool.isActive, "Pool not active");
        
        IERC20 lpToken = lpTokens[tokenAddress];
        require(address(lpToken) != address(0), "LP token not found");
        
        uint256 lpTokenSupply = lpToken.totalSupply();
        if (lpTokenAmount > lpTokenSupply) {
            revert InvalidPercentage();
        }
        
        uint256 tokenAmount = (pool.tokenReserve * lpTokenAmount) / lpTokenSupply;
        uint256 daiAmount = (pool.daiReserve * lpTokenAmount) / lpTokenSupply;
        
        // Burn LP tokens
        LPToken(address(lpToken)).burn(msg.sender, lpTokenAmount);
        
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

    /// @notice Creates a new LP token for a pool
    /// @param tokenAddress Royalty token address
    /// @return LP token contract address
    function createLPToken(address tokenAddress) private returns (IERC20) {
        string memory tokenSymbol = IERC20Metadata(tokenAddress).symbol();
        string memory lpName = string(abi.encodePacked("PumpMusic LP ", tokenSymbol));
        string memory lpSymbol = string(abi.encodePacked("PMP-LP-", tokenSymbol));
        
        LPToken lpToken = new LPToken(lpName, lpSymbol);
        address lpTokenAddress = address(lpToken);
        lpTokens[tokenAddress] = IERC20(lpTokenAddress);
        allLPTokens.push(lpTokenAddress);
        
        emit LPTokenDeployed(tokenAddress, lpTokenAddress);
        return IERC20(lpTokenAddress);
    }

    /// @notice Returns all LP tokens created by this contract
    /// @return Array of LP token addresses
    function getAllLPTokens() external view returns (address[] memory) {
        return allLPTokens;
    }

    /// @notice Checks if an address holds any LP tokens created by this contract
    /// @param holder Address to check
    /// @return tokens Array of LP token addresses held by the user
    /// @return balances Array of corresponding token balances
    function getLPTokenHoldings(address holder) external view returns (
        address[] memory tokens,
        uint256[] memory balances
    ) {
        uint256 count = allLPTokens.length;
        tokens = new address[](count);
        balances = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            address lpToken = allLPTokens[i];
            uint256 balance = IERC20(lpToken).balanceOf(holder);
            tokens[i] = lpToken;
            balances[i] = balance;
        }
    }
}