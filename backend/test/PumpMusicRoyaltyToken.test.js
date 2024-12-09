// test/PumpMusicRoyaltyToken.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpMusicRoyaltyToken", function () {
    // Fixture qui sera réutilisé pour chaque test
    async function deployTokenFixture() {
        // Get signers
        const [owner, artist, investor1, investor2] = await ethers.getSigners();

        // Deploy MockUSDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();

        // Token parameters
        const name = "Artist Token";
        const symbol = "ART";
        const royaltyPercentage = 100; // 0.001%
        const duration = 365 * 24 * 60 * 60; // 1 year
        const tokenPrice = ethers.parseUnits("1", 6); // 1 USDC

        // Deploy RoyaltyToken
        const RoyaltyToken = await ethers.getContractFactory("PumpMusicRoyaltyToken");
        const royaltyToken = await RoyaltyToken.connect(artist).deploy(
            name,
            symbol,
            royaltyPercentage,
            duration,
            tokenPrice,
            await mockUSDC.getAddress()
        );

        // Mint USDC to investors for testing
        await mockUSDC.mint(investor1.address, ethers.parseUnits("10000", 6));
        await mockUSDC.mint(investor2.address, ethers.parseUnits("10000", 6));

        return { 
            royaltyToken, 
            mockUSDC, 
            owner, 
            artist, 
            investor1, 
            investor2,
            royaltyPercentage,
            duration,
            tokenPrice
        };
    }

    describe("Deployment", function () {
        it("Should set the right name and symbol", async function () {
            const { royaltyToken } = await loadFixture(deployTokenFixture);
            expect(await royaltyToken.name()).to.equal("Artist Token");
            expect(await royaltyToken.symbol()).to.equal("ART");
        });

        it("Should set the right owner", async function () {
            const { royaltyToken, artist } = await loadFixture(deployTokenFixture);
            expect(await royaltyToken.owner()).to.equal(artist.address);
        });

        it("Should mint initial supply to artist", async function () {
            const { royaltyToken, artist } = await loadFixture(deployTokenFixture);
            const initialSupply = ethers.parseEther("1000000000");
            expect(await royaltyToken.balanceOf(artist.address)).to.equal(initialSupply);
        });

        it("Should set correct royalty parameters", async function () {
            const { royaltyToken, royaltyPercentage } = await loadFixture(deployTokenFixture);
            const royaltyInfo = await royaltyToken.royaltyInfo();
            expect(royaltyInfo.royaltyPercentage).to.equal(royaltyPercentage);
        });
    });

    describe("Token Sale", function () {
        it("Should allow listing tokens for sale", async function () {
            const { royaltyToken, artist, tokenPrice } = await loadFixture(deployTokenFixture);
            await royaltyToken.connect(artist).listTokensForSale(tokenPrice);
            expect(await royaltyToken.isListedForSale()).to.be.true;
            expect(await royaltyToken.tokenPrice()).to.equal(tokenPrice);
        });

        it("Should fail listing if not owner", async function () {
            const { royaltyToken, investor1, tokenPrice } = await loadFixture(deployTokenFixture);
            await expect(
                royaltyToken.connect(investor1).listTokensForSale(tokenPrice)
            ).to.be.revertedWithCustomError(royaltyToken, "OwnableUnauthorizedAccount");
        });

        it("Should allow token purchase", async function () {
            const { royaltyToken, mockUSDC, artist, investor1, tokenPrice } = await loadFixture(deployTokenFixture);
    
            // List tokens for sale
            await royaltyToken.connect(artist).listTokensForSale(tokenPrice);
            
            // Calculate amounts (considering USDC has 6 decimals and token has 18 decimals)
            const purchaseAmount = ethers.parseEther("1000"); // 1000 tokens (18 decimals)
            const cost = ethers.parseUnits("1000", 6); // 1000 USDC (6 decimals)
            
            // Approve and purchase
            await mockUSDC.connect(investor1).approve(await royaltyToken.getAddress(), cost);
            await royaltyToken.connect(investor1).purchaseTokens(purchaseAmount);
            
            // Verify balances
            expect(await royaltyToken.balanceOf(investor1.address)).to.equal(purchaseAmount);
            expect(await mockUSDC.balanceOf(artist.address)).to.equal(cost);
        });
    });

    describe("Royalty Distribution", function () {
        it("Should distribute royalties correctly", async function () {
            const { royaltyToken, artist, investor1 } = await loadFixture(deployTokenFixture);
    
            // Transfer tokens to investor
            const investorTokens = ethers.parseEther("1000");
            await royaltyToken.connect(artist).transfer(investor1.address, investorTokens);
            
            // Distribute royalties with correct format
            const royaltyAmount = ethers.parseEther("1");
            await royaltyToken.connect(artist).distributeRoyalties(ethers.parseEther("1"));
            
            // Verify royalty accounting
            const royaltyInfo = await royaltyToken.royaltyInfo();
            const platformFee = (royaltyAmount * 300n) / 10000n;
            const netRoyalties = royaltyAmount - platformFee;
            
            expect(royaltyInfo.totalRoyalties).to.equal(netRoyalties);
        });

        it("Should allow claiming royalties", async function () {
            const { royaltyToken, artist, investor1 } = await loadFixture(deployTokenFixture);
    
            // Setup initial state
            await royaltyToken.connect(artist).transfer(investor1.address, ethers.parseEther("1000"));
            await royaltyToken.connect(artist).distributeRoyalties(ethers.parseEther("1"));
            
            // Record balances and claim
            const balanceBefore = await ethers.provider.getBalance(investor1.address);
            await royaltyToken.connect(investor1).claimRoyalties();
            const balanceAfter = await ethers.provider.getBalance(investor1.address);
            
            expect(balanceAfter).to.be.gt(balanceBefore);
        });

        it("Should fail distribution after expiration", async function () {
            const { royaltyToken, artist } = await loadFixture(deployTokenFixture);
    
            // Increase time beyond duration
            await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]); // 366 days
            await ethers.provider.send("evm_mine");
            
            // Try to distribute royalties with correct format
            await expect(
                royaltyToken.connect(artist).distributeRoyalties(ethers.parseEther("1"))
            ).to.be.revertedWith("Royalty period expired");
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should prevent claiming with no tokens", async function () {
            const { royaltyToken, investor1 } = await loadFixture(deployTokenFixture);
            await expect(
                royaltyToken.connect(investor1).claimRoyalties()
            ).to.be.revertedWith("No tokens owned");
        });

        it("Should prevent claiming when no royalties available", async function () {
            const { royaltyToken, artist, investor1 } = await loadFixture(deployTokenFixture);
            await royaltyToken.connect(artist).transfer(investor1.address, ethers.parseEther("1000"));
            
            await expect(
                royaltyToken.connect(investor1).claimRoyalties()
            ).to.be.revertedWith("No royalties to claim");
        });

        it("Should handle zero token purchases", async function () {
            const { royaltyToken, artist } = await loadFixture(deployTokenFixture);
            await royaltyToken.connect(artist).listTokensForSale(ethers.parseUnits("1", 6));
            
            await expect(
                royaltyToken.connect(artist).purchaseTokens(0)
            ).to.be.revertedWith("Amount must be greater than 0");
        });

        it("Should prevent purchasing when not listed", async function () {
            const { royaltyToken, investor1 } = await loadFixture(deployTokenFixture);
            await expect(
                royaltyToken.connect(investor1).purchaseTokens(ethers.parseEther("1"))
            ).to.be.revertedWith("Tokens not listed for sale");
        });
    });
});