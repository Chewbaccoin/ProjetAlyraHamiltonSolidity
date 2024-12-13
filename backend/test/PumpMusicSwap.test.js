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

        // Deploy MockUSDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();

        // Deploy two mock tokens for testing
        const MockToken = await ethers.getContractFactory("MockToken");
        const token1 = await MockToken.deploy("Token1", "TK1");
        const token2 = await MockToken.deploy("Token2", "TK2");

        // Deploy PumpMusicSwap
        const PumpMusicSwap = await ethers.getContractFactory("PumpMusicSwap");
        const swap = await PumpMusicSwap.deploy(await mockUSDC.getAddress());

        // Mint initial tokens
        const initialMint = ethers.parseEther("1000000");
        await mockUSDC.mint(user1.address, ethers.parseUnits("1000000", 6)); // USDC uses 6 decimals
        await mockUSDC.mint(user2.address, ethers.parseUnits("1000000", 6));
        await token1.mint(user1.address, initialMint);
        await token2.mint(user2.address, initialMint);

        return {
            swap,
            mockUSDC,
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

        it("Should set the correct USDC address", async function () {
            const { swap, mockUSDC } = await loadFixture(deploySwapFixture);
            expect(await swap.USDC()).to.equal(await mockUSDC.getAddress());
        });
    });

    describe("Liquidity Management", function () {
        it("Should allow adding liquidity", async function () {
            const { swap, mockUSDC, token1, user1 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const usdcAmount = ethers.parseUnits("1000", 6);

            // Approve tokens
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockUSDC.connect(user1).approve(await swap.getAddress(), usdcAmount);

            // Add liquidity
            await expect(swap.connect(user1).addLiquidity(
                await token1.getAddress(),
                tokenAmount,
                usdcAmount
            )).to.emit(swap, "LiquidityAdded")
              .withArgs(await token1.getAddress(), tokenAmount, usdcAmount);

            const pool = await swap.liquidityPools(await token1.getAddress());
            expect(pool.tokenReserve).to.equal(tokenAmount);
            expect(pool.usdcReserve).to.equal(usdcAmount);
            expect(pool.isActive).to.be.true;
        });

        it("Should allow removing liquidity", async function () {
            const { swap, mockUSDC, token1, user1 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const usdcAmount = ethers.parseUnits("1000", 6);

            // Add liquidity first
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockUSDC.connect(user1).approve(await swap.getAddress(), usdcAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), tokenAmount, usdcAmount);

            // Remove 50% of liquidity
            await expect(swap.connect(user1).removeLiquidity(await token1.getAddress(), 50))
                .to.emit(swap, "LiquidityRemoved")
                .withArgs(await token1.getAddress(), tokenAmount / 2n, usdcAmount / 2n);

            const pool = await swap.liquidityPools(await token1.getAddress());
            expect(pool.tokenReserve).to.equal(tokenAmount / 2n);
            expect(pool.usdcReserve).to.equal(usdcAmount / 2n);
        });
    });

    describe("Swap Operations", function () {
        it("Should calculate correct swap amounts", async function () {
            const { swap } = await loadFixture(deploySwapFixture);
            
            const amountIn = ethers.parseEther("100");
            const reserveIn = ethers.parseEther("1000");
            const reserveOut = ethers.parseEther("1000");
        
            const amountOut = await swap.getSwapAmount(amountIn, reserveIn, reserveOut);
            
            // Let's calculate the expected minimum output more precisely:
            // 1. First apply the 0.3% fee: amountIn * 997/1000
            // 2. Then account for slippage from the AMM curve
            // For x*y=k AMM with equal reserves, the output will be less than the input
            // due to the curve's design
            
            const expectedMinOutput = (amountIn * 88n) / 100n; // Expect at least 88% of input
            
            expect(amountOut).to.be.lt(amountIn); // Should get less out than in
            expect(amountOut).to.be.gt(expectedMinOutput); // Should be above minimum threshold
        });

        it("Should allow token to USDC swap", async function () {
            const { swap, mockUSDC, token1, user1 } = await loadFixture(deploySwapFixture);
            
            // Add initial liquidity with 1:1 ratio
            const initTokenAmount = ethers.parseEther("1000");
            const initUsdcAmount = ethers.parseUnits("1000", 6); // USDC uses 6 decimals
            
            await token1.connect(user1).approve(await swap.getAddress(), initTokenAmount);
            await mockUSDC.connect(user1).approve(await swap.getAddress(), initUsdcAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), initTokenAmount, initUsdcAmount);
        
            // Calculate expected output with fee
            const swapAmount = ethers.parseEther("100");
            const expectedOutput = await swap.getSwapAmount(
                swapAmount,
                initTokenAmount,
                initUsdcAmount
            );
            
            // Set minimum amount slightly below expected (to account for slippage)
            const minUSDCAmount = expectedOutput * 995n / 1000n;  // 0.5% slippage tolerance
        
            await token1.connect(user1).approve(await swap.getAddress(), swapAmount);
            await expect(swap.connect(user1).swapTokenForUSDC(
                await token1.getAddress(),
                swapAmount,
                minUSDCAmount
            )).to.emit(swap, "TokenSwapped");
        });

        it("Should allow USDC to token swap", async function () {
            const { swap, mockUSDC, token1, user1 } = await loadFixture(deploySwapFixture);
            
            // Add initial liquidity with 1:1 ratio
            const initTokenAmount = ethers.parseEther("1000");
            const initUsdcAmount = ethers.parseUnits("1000", 6); // USDC uses 6 decimals
            
            await token1.connect(user1).approve(await swap.getAddress(), initTokenAmount);
            await mockUSDC.connect(user1).approve(await swap.getAddress(), initUsdcAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), initTokenAmount, initUsdcAmount);
        
            // Calculate expected output with fee
            const swapAmount = ethers.parseUnits("100", 6); // 100 USDC
            const expectedOutput = await swap.getSwapAmount(
                swapAmount,
                initUsdcAmount,
                initTokenAmount
            );
            
            // Set minimum amount slightly below expected (to account for slippage)
            const minTokenAmount = expectedOutput * 995n / 1000n; // 0.5% slippage tolerance
        
            await mockUSDC.connect(user1).approve(await swap.getAddress(), swapAmount);
            await expect(swap.connect(user1).swapUSDCForToken(
                await token1.getAddress(),
                swapAmount,
                minTokenAmount
            )).to.emit(swap, "TokenSwapped");
        });
    });

    describe("Price Calculation", function () {
        it("Should return correct token price", async function () {
            const { swap, mockUSDC, token1, user1 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const usdcAmount = ethers.parseUnits("2000", 6);
        
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockUSDC.connect(user1).approve(await swap.getAddress(), usdcAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), tokenAmount, usdcAmount);
        
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
            const { swap, mockUSDC, token1, user1 } = await loadFixture(deploySwapFixture);
            
            // Add initial liquidity
            const initTokenAmount = ethers.parseEther("1000");
            const initUsdcAmount = ethers.parseUnits("1000", 6);
            
            await token1.connect(user1).approve(await swap.getAddress(), initTokenAmount);
            await mockUSDC.connect(user1).approve(await swap.getAddress(), initUsdcAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), initTokenAmount, initUsdcAmount);

            // Try swap with unreasonably high minimum output
            const swapAmount = ethers.parseEther("100");
            const unreasonableMinAmount = ethers.parseUnits("1000", 6); // Expecting more than input

            await token1.connect(user1).approve(await swap.getAddress(), swapAmount);
            await expect(
                swap.connect(user1).swapTokenForUSDC(
                    await token1.getAddress(),
                    swapAmount,
                    unreasonableMinAmount
                )
            ).to.be.revertedWith("Insufficient output amount");
        });
    });
});