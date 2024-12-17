// test/PumpMusicSwap.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpMusicSwap", function () {
    // Add constants
    const BASIS_POINTS = 1000;
    const SWAP_FEE = 30;
    const SCALE_FACTOR = 1e12;

    async function deploySwapFixture() {
        const [owner, user1, user2] = await ethers.getSigners();

        // Deploy MockDAI
        const MockDAI = await ethers.getContractFactory("MockDAI");
        const mockDAI = await MockDAI.deploy();

        // Deploy two mock tokens for testing
        const MockToken = await ethers.getContractFactory("MockToken");
        const token1 = await MockToken.deploy("Token1", "TK1");
        const token2 = await MockToken.deploy("Token2", "TK2");

        // Deploy PumpMusicSwap
        const PumpMusicSwap = await ethers.getContractFactory("PumpMusicSwap");
        const swap = await PumpMusicSwap.deploy(await mockDAI.getAddress());

        // Mint initial tokens
        const initialMint = ethers.parseEther("1000000");
        await mockDAI.mint(user1.address, initialMint); // DAI uses 18 decimals
        await mockDAI.mint(user2.address, initialMint);
        await token1.mint(user1.address, initialMint);
        await token2.mint(user2.address, initialMint);

        return {
            swap,
            mockDAI,
            token1,
            token2,
            owner,
            user1,
            user2,
            initialMint
        };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { swap, owner } = await loadFixture(deploySwapFixture);
            expect(await swap.owner()).to.equal(owner.address);
        });

        it("Should set the correct DAI address", async function () {
            const { swap, mockDAI } = await loadFixture(deploySwapFixture);
            expect(await swap.DAI()).to.equal(await mockDAI.getAddress());
        });
    });

    describe("Liquidity Management", function () {
        it("Should allow adding liquidity", async function () {
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            // Approve tokens
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);

            // Add liquidity
            await expect(swap.connect(user1).addLiquidity(
                await token1.getAddress(),
                tokenAmount,
                daiAmount
            )).to.emit(swap, "LiquidityAdded")
              .withArgs(await token1.getAddress(), tokenAmount, daiAmount);

            const pool = await swap.liquidityPools(await token1.getAddress());
            expect(pool.tokenReserve).to.equal(tokenAmount);
            expect(pool.daiReserve).to.equal(daiAmount);
            expect(pool.isActive).to.be.true;
        });

        it("Should allow removing liquidity", async function () {
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            // Add liquidity first
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), tokenAmount, daiAmount);

            // Remove 50% of liquidity
            await expect(swap.connect(user1).removeLiquidity(await token1.getAddress(), 50))
                .to.emit(swap, "LiquidityRemoved")
                .withArgs(await token1.getAddress(), tokenAmount / 2n, daiAmount / 2n);

            const pool = await swap.liquidityPools(await token1.getAddress());
            expect(pool.tokenReserve).to.equal(tokenAmount / 2n);
            expect(pool.daiReserve).to.equal(daiAmount / 2n);
        });
    });

    describe("Swap Operations", function () {
        it("Should calculate correct swap amounts", async function () {
            const { swap } = await loadFixture(deploySwapFixture);
            
            const amountIn = ethers.parseEther("100");
            const reserveIn = ethers.parseEther("1000");
            const reserveOut = ethers.parseEther("1000");
        
            const amountOut = await swap.getSwapAmount(amountIn, reserveIn, reserveOut);
            const expectedMinOutput = (amountIn * 88n) / 100n; // Expect at least 88% of input
            
            expect(amountOut).to.be.lt(amountIn);
            expect(amountOut).to.be.gt(expectedMinOutput);
        });

        it("Should allow token to DAI swap", async function () {
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            // Add initial liquidity with 1:1 ratio
            const initTokenAmount = ethers.parseEther("1000");
            const initDaiAmount = ethers.parseEther("1000");
            
            await token1.connect(user1).approve(await swap.getAddress(), initTokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), initDaiAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), initTokenAmount, initDaiAmount);
        
            // Calculate expected output with fee
            const swapAmount = ethers.parseEther("100");
            const expectedOutput = await swap.getSwapAmount(
                swapAmount,
                initTokenAmount,
                initDaiAmount
            );
            
            const minDaiAmount = expectedOutput * 995n / 1000n;  // 0.5% slippage tolerance
        
            await token1.connect(user1).approve(await swap.getAddress(), swapAmount);
            await expect(swap.connect(user1).swapTokenForDAI(
                await token1.getAddress(),
                swapAmount,
                minDaiAmount
            )).to.emit(swap, "TokenSwapped");
        });

        it("Should allow DAI to token swap", async function () {
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            const initTokenAmount = ethers.parseEther("1000");
            const initDaiAmount = ethers.parseEther("1000");
            
            await token1.connect(user1).approve(await swap.getAddress(), initTokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), initDaiAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), initTokenAmount, initDaiAmount);
        
            const swapAmount = ethers.parseEther("100");
            const expectedOutput = await swap.getSwapAmount(
                swapAmount,
                initDaiAmount,
                initTokenAmount
            );
            
            const minTokenAmount = expectedOutput * 995n / 1000n;
        
            await mockDAI.connect(user1).approve(await swap.getAddress(), swapAmount);
            await expect(swap.connect(user1).swapDAIForToken(
                await token1.getAddress(),
                swapAmount,
                minTokenAmount
            )).to.emit(swap, "TokenSwapped");
        });
    });

    describe("Price Calculation", function () {
        it("Should return correct token price", async function () {
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("2000");
        
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), tokenAmount, daiAmount);
        
            const price = await swap.getTokenPrice(await token1.getAddress());
            expect(price).to.equal(ethers.parseEther("2")); 
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should prevent adding zero liquidity", async function () {
            const { swap, token1 } = await loadFixture(deploySwapFixture);
            await expect(
                swap.addLiquidity(await token1.getAddress(), 0, 0)
            ).to.be.revertedWith("Amounts must be greater than 0");
        });

        it("Should prevent removing more than 100% liquidity", async function () {
            const { swap, token1 } = await loadFixture(deploySwapFixture);
            await expect(
                swap.removeLiquidity(await token1.getAddress(), 101)
            ).to.be.revertedWith("Invalid percentage");
        });

        it("Should prevent swaps with insufficient output amount", async function () {
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            const initTokenAmount = ethers.parseEther("1000");
            const initDaiAmount = ethers.parseEther("1000");
            
            await token1.connect(user1).approve(await swap.getAddress(), initTokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), initDaiAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), initTokenAmount, initDaiAmount);

            const swapAmount = ethers.parseEther("100");
            const unreasonableMinAmount = ethers.parseEther("1000");

            await token1.connect(user1).approve(await swap.getAddress(), swapAmount);
            await expect(
                swap.connect(user1).swapTokenForDAI(
                    await token1.getAddress(),
                    swapAmount,
                    unreasonableMinAmount
                )
            ).to.be.revertedWith("Insufficient output amount");
        });

        it("Should prevent swaps with insufficient liquidity", async function () {
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            const smallAmount = ethers.parseEther("1");
            
            await token1.connect(user1).approve(await swap.getAddress(), smallAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), smallAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), smallAmount, smallAmount);
            
            const largeAmount = ethers.parseEther("100");
            await token1.connect(user1).approve(await swap.getAddress(), largeAmount);
            
            await expect(swap.connect(user1).swapTokenForDAI(
                await token1.getAddress(),
                largeAmount,
                0
            )).to.be.revertedWith("Insufficient liquidity");
        });
    });

    describe("Token to Token Swap", function () {
        it("should allow swapping between two tokens", async function () {
            const { swap, mockDAI, token1, token2, user1, user2 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), tokenAmount, daiAmount);

            await token2.connect(user2).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user2).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user2).addLiquidity(await token2.getAddress(), tokenAmount, daiAmount);

            const swapAmount = ethers.parseEther("100");
            const minOutputAmount = ethers.parseEther("75");

            await token1.connect(user1).approve(await swap.getAddress(), swapAmount);
            await expect(
                swap.connect(user1).swapTokenForToken(
                    await token1.getAddress(),
                    await token2.getAddress(),
                    swapAmount,
                    minOutputAmount
                )
            ).to.emit(swap, "TokenSwapped");
        });

        it("should revert when output amount is insufficient", async function () {
            const { swap, mockDAI, token1, token2, user1, user2 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), tokenAmount, daiAmount);

            await token2.connect(user2).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user2).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user2).addLiquidity(await token2.getAddress(), tokenAmount, daiAmount);

            const swapAmount = ethers.parseEther("100");
            const unreasonableMinAmount = ethers.parseEther("1000");
            
            await token1.connect(user1).approve(await swap.getAddress(), swapAmount);
            await expect(
                swap.connect(user1).swapTokenForToken(
                    await token1.getAddress(),
                    await token2.getAddress(),
                    swapAmount,
                    unreasonableMinAmount
                )
            ).to.be.revertedWith("Insufficient output amount");
        });
    });
});