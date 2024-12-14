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

    // State variables
    RoyaltyInfo public royaltyInfo;
    uint256 public constant PLATFORM_FEE = 300; // 3% in basis points
    uint256 public tokenPrice;                  // Token price in DAI (18 decimals)
    IERC20 public immutable daiToken;                    // Reference to DAI contract
    bool public isListedForSale;               // Token sale status
    
    // Mapping to track last royalty claims
    mapping(address => uint256) public lastClaimTime;

    // Events
    event RoyaltyReceived(uint256 amount, uint256 platformFee);
    event RoyaltyClaimed(address indexed holder, uint256 amount);
    event TokensListed(uint256 price);
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 price);

    // Errors
    error RoyaltyPeriodExpired();
    error NoTokensOwned();
    error NoRoyaltiesToClaim();
    error ShareTooSmall();
    error TransferFailed();
    error InvalidPrice();
    error TokensNotListed();
    error InvalidAmount();
    error InsufficientBalance();
    error InsufficientAllowance();

    /// @notice Contract constructor
    /// @dev Initializes the token with its base parameters
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param _royaltyPercentage Royalty percentage (in basis points)
    /// @param _duration Rights validity duration in seconds
    /// @param _tokenPrice Initial token price in DAI (18 decimals)
    /// @param _daiAddress DAI contract address
    constructor(
        string memory name,
        string memory symbol,
        uint256 _royaltyPercentage,
        uint256 _duration,
        uint256 _tokenPrice,
        address _daiAddress
    ) ERC20(name, symbol) Ownable(msg.sender) {
        royaltyInfo.royaltyPercentage = _royaltyPercentage;
        royaltyInfo.expirationDate = block.timestamp + _duration;
        tokenPrice = _tokenPrice;
        daiToken = IERC20(_daiAddress);
        _mint(address(this), 1_000_000_000 * 10**decimals());
    }

    /// @notice Distribute received royalties
    /// @dev Deduct platform fees and update total royalties
    /// @param amount Amount of royalties to distribute
    function distributeRoyalties(uint256 amount) external nonReentrant {
        if (block.timestamp >= royaltyInfo.expirationDate) revert RoyaltyPeriodExpired();
        
        // Calculate platform fees
        uint256 platformFeeAmount = (amount * PLATFORM_FEE) / 10000;
        uint256 netAmount = amount - platformFeeAmount;
        
        // Update total royalties
        royaltyInfo.totalRoyalties += netAmount;
        emit RoyaltyReceived(amount, platformFeeAmount);
        
        // Transfer fees to the platform
        (bool success, ) = payable(owner()).call{value: platformFeeAmount}("");
        require(success, "Platform fee transfer failed");
    }

    /// @notice Allow holders to claim their royalties
    /// @dev Calculate and transfer royalty share based on owned tokens
    function claimRoyalties() external nonReentrant {
        if (balanceOf(msg.sender) == 0) revert NoTokensOwned();
        if (royaltyInfo.totalRoyalties == 0) revert NoRoyaltiesToClaim();
        
        // Modify calculation to avoid precision loss
        uint256 userBalance = balanceOf(msg.sender);
        uint256 supply = totalSupply();
        // Calculate percentage first, then multiply by total royalties
        uint256 share = (userBalance * 1e18 / supply) * royaltyInfo.totalRoyalties / 1e18;
        if (share == 0) revert ShareTooSmall();
        
        royaltyInfo.totalRoyalties -= share;
        lastClaimTime[msg.sender] = block.timestamp;
        
        (bool success, ) = payable(msg.sender).call{value: share}("");
        require(success, "Transfer failed");
        
        emit RoyaltyClaimed(msg.sender, share);
    }

    /// @notice List tokens for sale
    /// @dev Only callable by the owner
    /// @param _price Sale price in DAI (18 decimals)
    function listTokensForSale(uint256 _price) external onlyOwner {
        if (_price == 0) revert InvalidPrice();
        tokenPrice = _price;
        isListedForSale = true;
        emit TokensListed(_price);
    }

    /// @notice Allow purchase of tokens
    /// @dev Transfer DAI to seller and tokens to buyer
    /// @param amount Number of tokens to purchase (in wei)
    function purchaseTokens(uint256 amount) external nonReentrant {
        if (!isListedForSale) revert TokensNotListed();
        if (amount == 0) revert InvalidAmount();
        
        // Calculate cost in DAI (both DAI and our token use 18 decimals)
        uint256 cost = (amount * tokenPrice) / (10**decimals());
        if (cost == 0) revert InvalidPrice();
        
        // Verify buyer's DAI balance
        uint256 buyerBalance = daiToken.balanceOf(msg.sender);
        if (buyerBalance < cost) revert InsufficientBalance();
        
        // Verify DAI allowance
        uint256 allowance = daiToken.allowance(msg.sender, address(this));
        if (allowance < cost) revert InsufficientAllowance();
        
        require(daiToken.transferFrom(msg.sender, owner(), cost), "DAI transfer failed");
        
        // Transfer tokens from the contract's balance instead of the owner's
        _transfer(address(this), msg.sender, amount);
        emit TokensPurchased(msg.sender, amount, cost);
    }

    /// @notice Check if royalty period is still active
    /// @return bool Indicates if the period is active
    function isRoyaltyPeriodActive() public view returns (bool) {
        return block.timestamp < royaltyInfo.expirationDate;
    }

    receive() external payable {
        // Allow contract to receive ETH
    }
}