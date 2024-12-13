// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockDAI
 * @dev A mock DAI token contract for testing purposes
 * Inherits from OpenZeppelin's ERC20 and Ownable contracts
 */
contract MockDAI is ERC20, Ownable {
    // Constants
    uint256 private constant INITIAL_SUPPLY = 1_000_000_000;
    uint8 private constant DAI_DECIMALS = 18;

    /**
     * @dev Constructor that gives msg.sender all of initial supply
     */
    constructor() ERC20("DAI Coin", "DAI") Ownable(msg.sender) {
        _mint(msg.sender, INITIAL_SUPPLY * 10**DAI_DECIMALS);
    }

    /**
     * @dev Creates `amount` tokens and assigns them to `to`
     * Can only be called by the current owner
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "MockDAI: mint to the zero address");
        _mint(to, amount);
    }

    /**
     * @dev Returns the number of decimals used for token amounts
     */
    function decimals() public pure override returns (uint8) {
        return DAI_DECIMALS;
    }
}