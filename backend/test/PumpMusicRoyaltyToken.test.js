// test/PumpMusicRoyaltyToken.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpMusicRoyaltyToken", function () {
    // Fixture which will be reused for each test
    async function deployTokenFixture() {
        // Get signers
        const [owner, artist, investor1, investor2] = await ethers.getSigners();

        // Deploy MockDAI
        const MockDAI = await ethers.getContractFactory("MockUSDC");
        const mockDAI = await MockDAI.deploy();

        // Token parameters
        const name = "Artist Token";
        const symbol = "ART";
        const royaltyPercentage = 100; // 0.001%
        const duration = 365 * 24 * 60 * 60; // 1 year
        const tokenPrice = ethers.parseEther("1"); // 1 DAI

        // Deploy RoyaltyToken
        const RoyaltyToken = await ethers.getContractFactory("PumpMusicRoyaltyToken");
        const royaltyToken = await RoyaltyToken.connect(artist).deploy(
            name,
            symbol,
            royaltyPercentage,
            duration,
            tokenPrice,
            await mockDAI.getAddress()
        );

        // Mint DAI to investors for testing
        await mockDAI.mint(investor1.address, ethers.parseEther("10000"));
        await mockDAI.mint(investor2.address, ethers.parseEther("10000"));

        return { 
            royaltyToken, 
            mockDAI, 
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
            await expect(royaltyToken.connect(artist).listTokensForSale(tokenPrice))
                .to.emit(royaltyToken, "TokensListed")
                .withArgs(tokenPrice);
            expect(await royaltyToken.isListedForSale()).to.be.true;
            expect(await royaltyToken.tokenPrice()).to.equal(tokenPrice);
        });

        it("Should fail listing if not owner", async function () {
            const { royaltyToken, investor1, tokenPrice } = await loadFixture(deployTokenFixture);
            await expect(
                royaltyToken.connect(investor1).listTokensForSale(tokenPrice)
            ).to.be.revertedWithCustomError(royaltyToken, "OwnableUnauthorizedAccount");
        });

        it("Should handle token purchase with proper balance updates", async function () {
            const { royaltyToken, mockDAI, artist, investor1, tokenPrice } = await loadFixture(deployTokenFixture);
            
            // Get initial balances
            const artistInitialTokens = await royaltyToken.balanceOf(artist.address);
            const investorInitialTokens = await royaltyToken.balanceOf(investor1.address);
            const artistInitialDAI = await mockDAI.balanceOf(artist.address);
            const investorInitialDAI = await mockDAI.balanceOf(investor1.address);
            
            const purchaseAmount = ethers.parseEther("1");
            const cost = (purchaseAmount * tokenPrice) / ethers.parseEther("1");
            
            // List tokens for sale
            await royaltyToken.connect(artist).listTokensForSale(tokenPrice);
            
            // Approve before purchase
            await mockDAI.connect(investor1).approve(await royaltyToken.getAddress(), cost);
            
            // Purchase tokens
            await royaltyToken.connect(investor1).purchaseTokens(purchaseAmount);
            
            // Verify balances
            expect(await royaltyToken.balanceOf(investor1.address))
                .to.equal(investorInitialTokens + purchaseAmount);
            expect(await royaltyToken.balanceOf(artist.address))
                .to.equal(artistInitialTokens - purchaseAmount);
            expect(await mockDAI.balanceOf(artist.address))
                .to.equal(artistInitialDAI + cost);
            expect(await mockDAI.balanceOf(investor1.address))
                .to.equal(investorInitialDAI - cost);
        });
    });

    describe("Royalty Distribution", function () {
        it("Should distribute royalties correctly", async function () {
            const { royaltyToken, artist, investor1 } = await loadFixture(deployTokenFixture);
    
            // Transfer tokens to investor
            const investorTokens = ethers.parseEther("1000");
            await royaltyToken.connect(artist).transfer(investor1.address, investorTokens);
            
            // Fund the contract with ETH for platform fees
            await artist.sendTransaction({
                to: await royaltyToken.getAddress(),
                value: ethers.parseEther("10") // Envoyer 10 ETH au contrat
            });

            // Distribute royalties with correct format
            const royaltyAmount = ethers.parseEther("1");
            await royaltyToken.connect(artist).distributeRoyalties(ethers.parseEther("1"));

            // Verify royalty accounting
            const royaltyInfo = await royaltyToken.royaltyInfo();
            const platformFee = (royaltyAmount * 300n) / 10000n;
            const netRoyalties = royaltyAmount - platformFee;
            
            expect(royaltyInfo.totalRoyalties).to.equal(netRoyalties);

            // Verify royalty distribution event
            await expect(royaltyToken.connect(artist).distributeRoyalties(ethers.parseEther("1")))
                .to.emit(royaltyToken, "RoyaltyReceived")
                .withArgs(ethers.parseEther("1"), platformFee);
        });

        it("Should allow claiming royalties", async function () {
            const { royaltyToken, artist, investor1 } = await loadFixture(deployTokenFixture);
    
            // Fund the contract with ETH for platform fees
            await artist.sendTransaction({
                to: await royaltyToken.getAddress(),
                value: ethers.parseEther("10")
            });

            // Setup initial state
            await royaltyToken.connect(artist).transfer(investor1.address, ethers.parseEther("1000"));
            await royaltyToken.connect(artist).distributeRoyalties(ethers.parseEther("1"));
                        
            // Record balances and claim
            const balanceBefore = await ethers.provider.getBalance(investor1.address);
            const tx = await royaltyToken.connect(investor1).claimRoyalties();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const balanceAfter = await ethers.provider.getBalance(investor1.address);
            
            // Vérifier que le solde après + gaz utilisé est supérieur au solde avant
            expect(balanceAfter + gasUsed).to.be.gt(balanceBefore);
        });

        it("Should fail distribution after expiration", async function () {
            const { royaltyToken, artist } = await loadFixture(deployTokenFixture);
    
            // Increase time beyond duration
            await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]); // 366 days
            await ethers.provider.send("evm_mine");
            
            // Try to distribute royalties with correct format
            await expect(
                royaltyToken.connect(artist).distributeRoyalties(ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(royaltyToken, "RoyaltyPeriodExpired");
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should prevent claiming with no tokens", async function () {
            const { royaltyToken, investor1 } = await loadFixture(deployTokenFixture);
            await expect(
                royaltyToken.connect(investor1).claimRoyalties()
            ).to.be.revertedWithCustomError(royaltyToken, "NoTokensOwned");
        });

        it("Should prevent claiming when no royalties available", async function () {
            const { royaltyToken, artist, investor1 } = await loadFixture(deployTokenFixture);
            await royaltyToken.connect(artist).transfer(investor1.address, ethers.parseEther("1000"));
            
            await expect(
                royaltyToken.connect(investor1).claimRoyalties()
            ).to.be.revertedWithCustomError(royaltyToken, "NoRoyaltiesToClaim");
        });

        it("Should handle zero token purchases", async function () {
            const { royaltyToken, artist } = await loadFixture(deployTokenFixture);
            await royaltyToken.connect(artist).listTokensForSale(ethers.parseEther("1"));
            
            await expect(
                royaltyToken.connect(artist).purchaseTokens(0)
            ).to.be.revertedWithCustomError(royaltyToken, "InvalidAmount");
        });

        it("Should prevent purchasing when not listed", async function () {
            const { royaltyToken, investor1 } = await loadFixture(deployTokenFixture);
            await expect(
                royaltyToken.connect(investor1).purchaseTokens(ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(royaltyToken, "TokensNotListed");
        });
    });
});