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

        it("Should mint initial supply to contract", async function () {
            const { royaltyToken } = await loadFixture(deployTokenFixture);
            const initialSupply = ethers.parseEther("1000000000");
            expect(await royaltyToken.balanceOf(await royaltyToken.getAddress())).to.equal(initialSupply);
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
            const contractInitialTokens = await royaltyToken.balanceOf(await royaltyToken.getAddress());
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
            expect(await royaltyToken.balanceOf(await royaltyToken.getAddress()))
                .to.equal(contractInitialTokens - purchaseAmount);
            expect(await mockDAI.balanceOf(artist.address))
                .to.equal(artistInitialDAI + cost);
            expect(await mockDAI.balanceOf(investor1.address))
                .to.equal(investorInitialDAI - cost);
        });
    });

    describe("Royalty Distribution", function () {
        it("Should distribute royalties correctly", async function () {
            const { royaltyToken, artist, investor1, mockDAI } = await loadFixture(deployTokenFixture);
    
            // Purchase tokens with specific investment amount
            const tokenPrice = ethers.parseEther("1");
            const purchaseAmount = ethers.parseEther("1000");
            await royaltyToken.connect(artist).listTokensForSale(tokenPrice);
            await mockDAI.connect(investor1).approve(await royaltyToken.getAddress(), purchaseAmount);
            await royaltyToken.connect(investor1).purchaseTokens(purchaseAmount);
            
            // Verify investment tracking
            expect(await royaltyToken.userInvestments(investor1.address)).to.equal(purchaseAmount);
            expect(await royaltyToken.totalInvestments()).to.equal(purchaseAmount);
            
            // Fund the contract and distribute royalties
            const royaltyAmount = ethers.parseEther("1");
            await royaltyToken.connect(artist).distributeRoyalties(royaltyAmount, {
                value: royaltyAmount
            });

            // Verify royalty accounting
            const platformFee = (royaltyAmount * 300n) / 10000n;
            const netRoyalties = royaltyAmount - platformFee;
            expect((await royaltyToken.royaltyInfo()).totalRoyalties).to.equal(netRoyalties);
        });

        it("Should allow claiming royalties based on investment proportion", async function () {
            const { royaltyToken, artist, investor1, investor2, mockDAI } = await loadFixture(deployTokenFixture);
    
            // Setup: List tokens for sale
            const tokenPrice = ethers.parseEther("1");
            await royaltyToken.connect(artist).listTokensForSale(tokenPrice);

            // Investor1 buys tokens
            const investment1 = ethers.parseEther("1000");
            await mockDAI.connect(investor1).approve(await royaltyToken.getAddress(), investment1);
            await royaltyToken.connect(investor1).purchaseTokens(investment1);

            // Investor2 buys tokens
            const investment2 = ethers.parseEther("500");
            await mockDAI.connect(investor2).approve(await royaltyToken.getAddress(), investment2);
            await royaltyToken.connect(investor2).purchaseTokens(investment2);

            // Distribute royalties
            const royaltyAmount = ethers.parseEther("3");
            await artist.sendTransaction({
                to: await royaltyToken.getAddress(),
                value: ethers.parseEther("10")
            });
            await royaltyToken.connect(artist).distributeRoyalties(royaltyAmount, {
                value: royaltyAmount
            });

            // Calculate expected shares
            const platformFee = (royaltyAmount * 300n) / 10000n;
            const netRoyalties = royaltyAmount - platformFee;
            const investment1Cost = (investment1 * tokenPrice) / ethers.parseEther("1");
            const investment2Cost = (investment2 * tokenPrice) / ethers.parseEther("1");
            const totalInvestmentCost = investment1Cost + investment2Cost;
            const expectedShare1 = (investment1Cost * netRoyalties) / totalInvestmentCost;

            // Record balances and claim for investor1
            const balanceBefore = await ethers.provider.getBalance(investor1.address);
            const tx = await royaltyToken.connect(investor1).claimRoyalties();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const balanceAfter = await ethers.provider.getBalance(investor1.address);

            // Verify the claimed amount matches the investment proportion
            expect(balanceAfter + gasUsed - balanceBefore).to.equal(expectedShare1);
        });

        it("Should track investments correctly", async function () {
            const { royaltyToken, artist, investor1, mockDAI } = await loadFixture(deployTokenFixture);

            const tokenPrice = ethers.parseEther("1");
            await royaltyToken.connect(artist).listTokensForSale(tokenPrice);

            // Make multiple investments
            const investment1 = ethers.parseEther("500");
            const investment2 = ethers.parseEther("300");

            await mockDAI.connect(investor1).approve(await royaltyToken.getAddress(), investment1 + investment2);
            
            await royaltyToken.connect(investor1).purchaseTokens(investment1);
            expect(await royaltyToken.userInvestments(investor1.address)).to.equal(investment1);
            
            await royaltyToken.connect(investor1).purchaseTokens(investment2);
            expect(await royaltyToken.userInvestments(investor1.address)).to.equal(investment1 + investment2);
            expect(await royaltyToken.totalInvestments()).to.equal(investment1 + investment2);
        });

        it("Should fail distribution after expiration", async function () {
            const { royaltyToken, artist } = await loadFixture(deployTokenFixture);
    
            // Increase time beyond duration
            await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]); // 366 days
            await ethers.provider.send("evm_mine");
            
            // Try to distribute royalties with correct format
            await expect(
                royaltyToken.connect(artist).distributeRoyalties(ethers.parseEther("1"), {
                    value: ethers.parseEther("1")
                })
            ).to.be.revertedWithCustomError(royaltyToken, "RoyaltyPeriodExpired");
        });

        it("Should prevent claiming when no royalties available", async function () {
            const { royaltyToken, artist, investor1, mockDAI } = await loadFixture(deployTokenFixture);
            
            // First list and purchase tokens to give investor1 some tokens
            const purchaseAmount = ethers.parseEther("1000");
            await royaltyToken.connect(artist).listTokensForSale(ethers.parseEther("1"));
            await mockDAI.connect(investor1).approve(await royaltyToken.getAddress(), purchaseAmount);
            await royaltyToken.connect(investor1).purchaseTokens(purchaseAmount);
            
            // Try to claim without any royalties distributed - should fail
            await expect(
                royaltyToken.connect(investor1).claimRoyalties()
            ).to.be.revertedWithCustomError(royaltyToken, "NoRoyaltiesToClaim");
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
            const { royaltyToken, artist, investor1, mockDAI } = await loadFixture(deployTokenFixture);
            
            // First list and purchase tokens to give investor1 some tokens
            const purchaseAmount = ethers.parseEther("1000");
            await royaltyToken.connect(artist).listTokensForSale(ethers.parseEther("1"));
            await mockDAI.connect(investor1).approve(await royaltyToken.getAddress(), purchaseAmount);
            await royaltyToken.connect(investor1).purchaseTokens(purchaseAmount);
            
            // Try to claim without any royalties distributed - should fail
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

    describe("Holder Tracking", function () {
        it("Should track holders correctly when purchasing tokens", async function () {
            const { royaltyToken, artist, investor1, investor2, mockDAI } = await loadFixture(deployTokenFixture);
            
            // Initial state should be 0 holders
            expect(await royaltyToken.totalHolders()).to.equal(0);
            
            // List tokens for sale
            await royaltyToken.connect(artist).listTokensForSale(ethers.parseEther("1"));
            
            // First investor purchases tokens
            await mockDAI.connect(investor1).approve(await royaltyToken.getAddress(), ethers.parseEther("1000"));
            await royaltyToken.connect(investor1).purchaseTokens(ethers.parseEther("100"));
            expect(await royaltyToken.totalHolders()).to.equal(1);
            
            // Second investor purchases tokens
            await mockDAI.connect(investor2).approve(await royaltyToken.getAddress(), ethers.parseEther("1000"));
            await royaltyToken.connect(investor2).purchaseTokens(ethers.parseEther("100"));
            expect(await royaltyToken.totalHolders()).to.equal(2);
        });

        it("Should decrease holder count when balance becomes zero", async function () {
            const { royaltyToken, artist, investor1, mockDAI } = await loadFixture(deployTokenFixture);
            
            // List and purchase tokens
            await royaltyToken.connect(artist).listTokensForSale(ethers.parseEther("1"));
            await mockDAI.connect(investor1).approve(await royaltyToken.getAddress(), ethers.parseEther("1000"));
            await royaltyToken.connect(investor1).purchaseTokens(ethers.parseEther("100"));
            
            expect(await royaltyToken.totalHolders()).to.equal(1);
            
            // Transfer all tokens back to contract
            await royaltyToken.connect(investor1).transfer(
                await royaltyToken.getAddress(),
                ethers.parseEther("100")
            );
            
            expect(await royaltyToken.totalHolders()).to.equal(0);
        });
    });

    describe("Revenue and Royalty Tracking", function () {
        it("Should track royalties received correctly", async function () {
            const { royaltyToken, artist, investor1, mockDAI } = await loadFixture(deployTokenFixture);
            
            // Initial royalties received should be 0
            expect(await royaltyToken.getRoyaltiesReceived()).to.equal(0);
            
            // Setup: List and purchase tokens
            await royaltyToken.connect(artist).listTokensForSale(ethers.parseEther("1"));
            await mockDAI.connect(investor1).approve(
                await royaltyToken.getAddress(), 
                ethers.parseEther("1000")
            );
            await royaltyToken.connect(investor1).purchaseTokens(ethers.parseEther("100"));
            
            // Fund contract with ETH for royalties
            await artist.sendTransaction({
                to: await royaltyToken.getAddress(),
                value: ethers.parseEther("10")
            });
            
            // Distribute royalties multiple times
            const royaltyAmount1 = ethers.parseEther("1");
            const royaltyAmount2 = ethers.parseEther("2");
            
            await royaltyToken.connect(artist).distributeRoyalties(royaltyAmount1, {
                value: royaltyAmount1
            });
            expect(await royaltyToken.getRoyaltiesReceived()).to.equal(royaltyAmount1);
            
            await royaltyToken.connect(artist).distributeRoyalties(royaltyAmount2, {
                value: royaltyAmount2
            });
            expect(await royaltyToken.getRoyaltiesReceived()).to.equal(royaltyAmount1 + royaltyAmount2);
        });

        it("Should track amount raised from token sales correctly", async function () {
            const { royaltyToken, artist, investor1, mockDAI } = await loadFixture(deployTokenFixture);
            
            // Initial amount raised should be 0
            expect(await royaltyToken.getTotalAmountRaised()).to.equal(0);
            
            // List tokens for sale
            const tokenPrice = ethers.parseEther("1");
            await royaltyToken.connect(artist).listTokensForSale(tokenPrice);
            
            // Purchase tokens
            const purchaseAmount = ethers.parseEther("100");
            const expectedRaised = purchaseAmount * tokenPrice / ethers.parseEther("1");
            
            await mockDAI.connect(investor1).approve(
                await royaltyToken.getAddress(), 
                expectedRaised
            );
            await royaltyToken.connect(investor1).purchaseTokens(purchaseAmount);
            
            // Verify total amount raised
            expect(await royaltyToken.getTotalAmountRaised()).to.equal(expectedRaised);
        });

        it("Should track royalties and sales amounts independently", async function () {
            const { royaltyToken, artist, investor1, mockDAI } = await loadFixture(deployTokenFixture);
            
            // Setup: List and purchase tokens
            const tokenPrice = ethers.parseEther("1");
            const purchaseAmount = ethers.parseEther("100");
            await royaltyToken.connect(artist).listTokensForSale(tokenPrice);
            
            // Purchase tokens
            const expectedRaised = purchaseAmount * tokenPrice / ethers.parseEther("1");
            await mockDAI.connect(investor1).approve(
                await royaltyToken.getAddress(), 
                expectedRaised
            );
            await royaltyToken.connect(investor1).purchaseTokens(purchaseAmount);
            
            // Fund contract and distribute royalties
            const royaltyAmount = ethers.parseEther("1");
            await royaltyToken.connect(artist).distributeRoyalties(royaltyAmount, {
                value: royaltyAmount
            });
            
            // Verify both tracking systems independently
            expect(await royaltyToken.getTotalAmountRaised()).to.equal(expectedRaised);
            expect(await royaltyToken.getRoyaltiesReceived()).to.equal(royaltyAmount);
        });
    });

    describe("Royalty Claiming Tracking", function () {
        it("Should track royalties claimed by individual investors", async function () {
            const { royaltyToken, artist, investor1, investor2, mockDAI } = await loadFixture(deployTokenFixture);
            
            // Setup: List tokens for sale
            const tokenPrice = ethers.parseEther("1");
            await royaltyToken.connect(artist).listTokensForSale(tokenPrice);

            // Investor1 and Investor2 buy different amounts
            const investment1 = ethers.parseEther("1000");
            const investment2 = ethers.parseEther("500");
            
            // Calculate the actual DAI costs
            const investment1Cost = (investment1 * tokenPrice) / ethers.parseEther("1");
            const investment2Cost = (investment2 * tokenPrice) / ethers.parseEther("1");
            
            await mockDAI.connect(investor1).approve(await royaltyToken.getAddress(), investment1Cost);
            await mockDAI.connect(investor2).approve(await royaltyToken.getAddress(), investment2Cost);
            
            await royaltyToken.connect(investor1).purchaseTokens(investment1);
            await royaltyToken.connect(investor2).purchaseTokens(investment2);

            // Distribute royalties
            const royaltyAmount = ethers.parseEther("3");
            await artist.sendTransaction({
                to: await royaltyToken.getAddress(),
                value: ethers.parseEther("10") // Fund contract
            });
            await royaltyToken.connect(artist).distributeRoyalties(royaltyAmount, {
                value: royaltyAmount
            });

            // Calculate expected shares based on DAI investment
            const platformFee = (royaltyAmount * 300n) / 10000n;
            const netRoyalties = royaltyAmount - platformFee;
            const totalInvestmentCost = investment1Cost + investment2Cost;
            
            // This is the key change - calculate share based on DAI investment
            const expectedShare1 = (investment1Cost * netRoyalties) / totalInvestmentCost;

            // Claim and verify
            await royaltyToken.connect(investor1).claimRoyalties();
            
            expect(await royaltyToken.getTotalRoyaltiesClaimed(investor1.address))
                .to.be.closeTo(expectedShare1, 2);
        });

        it("Should accumulate claimed royalties over multiple distributions", async function () {
            const { royaltyToken, artist, investor1, mockDAI } = await loadFixture(deployTokenFixture);
            
            // Setup: List and purchase tokens
            await royaltyToken.connect(artist).listTokensForSale(ethers.parseEther("1"));
            await mockDAI.connect(investor1).approve(
                await royaltyToken.getAddress(),
                ethers.parseEther("1000")
            );
            await royaltyToken.connect(investor1).purchaseTokens(ethers.parseEther("1000"));

            // Fund contract
            await artist.sendTransaction({
                to: await royaltyToken.getAddress(),
                value: ethers.parseEther("10")
            });

            // First distribution and claim
            const firstRoyalty = ethers.parseEther("2");
            await royaltyToken.connect(artist).distributeRoyalties(firstRoyalty, {
                value: firstRoyalty
            });
            await royaltyToken.connect(investor1).claimRoyalties();
            
            const firstClaimed = await royaltyToken.getTotalRoyaltiesClaimed(investor1.address);

            // Second distribution and claim
            const secondRoyalty = ethers.parseEther("3");
            await royaltyToken.connect(artist).distributeRoyalties(secondRoyalty, {
                value: secondRoyalty
            });
            await royaltyToken.connect(investor1).claimRoyalties();

            const totalClaimed = await royaltyToken.getTotalRoyaltiesClaimed(investor1.address);
            
            // Verify total claimed is sum of both distributions (minus platform fees)
            const totalRoyalties = firstRoyalty + secondRoyalty;
            const platformFee = (totalRoyalties * 300n) / 10000n;
            const expectedTotal = totalRoyalties - platformFee;
            
            expect(totalClaimed).to.be.closeTo(expectedTotal, 2);
            expect(totalClaimed).to.be.gt(firstClaimed);
        });

        it("Should return zero for addresses that never claimed", async function () {
            const { royaltyToken, investor1 } = await loadFixture(deployTokenFixture);
            expect(await royaltyToken.getTotalRoyaltiesClaimed(investor1.address)).to.equal(0);
        });

        it("Should track claims accurately when investor has multiple purchases", async function () {
            const { royaltyToken, artist, investor1, mockDAI } = await loadFixture(deployTokenFixture);
            
            // Setup: List tokens for sale
            await royaltyToken.connect(artist).listTokensForSale(ethers.parseEther("1"));
            
            // Make multiple purchases
            const firstPurchase = ethers.parseEther("500");
            const secondPurchase = ethers.parseEther("500");
            
            await mockDAI.connect(investor1).approve(
                await royaltyToken.getAddress(),
                firstPurchase + secondPurchase
            );
            
            await royaltyToken.connect(investor1).purchaseTokens(firstPurchase);
            await royaltyToken.connect(investor1).purchaseTokens(secondPurchase);

            // Distribute and claim royalties
            const royaltyAmount = ethers.parseEther("5");
            await artist.sendTransaction({
                to: await royaltyToken.getAddress(),
                value: ethers.parseEther("10")
            });
            
            await royaltyToken.connect(artist).distributeRoyalties(royaltyAmount, {
                value: royaltyAmount
            });

            await royaltyToken.connect(investor1).claimRoyalties();

            // Calculate expected royalties (accounting for platform fee)
            const platformFee = (royaltyAmount * 300n) / 10000n;
            const expectedRoyalties = royaltyAmount - platformFee;

            expect(await royaltyToken.getTotalRoyaltiesClaimed(investor1.address))
                .to.be.closeTo(expectedRoyalties, 2);
        });
    });

    describe("Royalty Period", function () {
        it("should correctly check if royalty period is active", async function () {
            const { royaltyToken } = await loadFixture(deployTokenFixture);
            
            // Should be active initially
            expect(await royaltyToken.isRoyaltyPeriodActive()).to.be.true;

            // Increase time beyond duration
            await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]); // 366 days
            await ethers.provider.send("evm_mine");

            // Should be inactive after period expires
            expect(await royaltyToken.isRoyaltyPeriodActive()).to.be.false;
        });
    });

    describe("Edge Cases", function () {
        it("should handle zero amount token purchases", async function () {
            const { royaltyToken } = await loadFixture(deployTokenFixture);
            await expect(royaltyToken.purchaseTokens(0))
                .to.be.revertedWithCustomError(royaltyToken, "InvalidAmount");
        });

        it("should prevent distributing zero royalties", async function () {
            const { royaltyToken, artist } = await loadFixture(deployTokenFixture);
            await expect(royaltyToken.connect(artist).distributeRoyalties(0))
                .to.be.revertedWith("Amount must be greater than 0");
        });

        it("should handle multiple royalty distributions", async function () {
            const { royaltyToken, artist } = await loadFixture(deployTokenFixture);
            await royaltyToken.connect(artist).distributeRoyalties(ethers.parseEther("1"), {
                value: ethers.parseEther("1")
            });
            await royaltyToken.connect(artist).distributeRoyalties(ethers.parseEther("2"), {
                value: ethers.parseEther("2")
            });
            // Verify cumulative royalties
            const royaltyInfo = await royaltyToken.royaltyInfo();
            expect(royaltyInfo.totalRoyalties).to.be.gt(ethers.parseEther("2.5"));
        });
    });
});