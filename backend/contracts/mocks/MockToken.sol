// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockToken
 * @dev Implementation of a mock ERC20 token for testing purposes
 * @custom:security-contact security@yourproject.com
 */
contract MockToken is ERC20 {
    /// @dev Access control state variables (if needed)
    
    /// @dev Other state variables (if needed)

    /**
     * @dev Constructor that initializes the token with a name and symbol
     * @param name The name of the token
     * @param symbol The symbol of the token
     */
    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        // Additional initialization if needed
    }

    /// @dev External functions

    /**
     * @dev Mints new tokens to a specified address
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     * @notice This function is public for testing purposes only
     * @custom:security This function should be restricted in production
     */
    function mint(
        address to,
        uint256 amount
    ) public {
        _mint(to, amount);
    }

    /// @dev Public view/pure functions (if needed)

    /// @dev Internal functions (if needed)

    /// @dev Private functions (if needed)
}