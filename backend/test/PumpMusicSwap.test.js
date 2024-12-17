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
        await token1.mint(user2.address, initialMint);
        await token2.mint(user1.address, initialMint);
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
            await expect(swap.connect(user1).removeLiquidity(
                await token1.getAddress(), 
                ethers.parseEther("500")
            )).to.emit(swap, "LiquidityRemoved")
              .withArgs(await token1.getAddress(), tokenAmount / 2n, daiAmount / 2n);

            const pool = await swap.liquidityPools(await token1.getAddress());
            expect(pool.tokenReserve).to.equal(tokenAmount / 2n);
            expect(pool.daiReserve).to.equal(daiAmount / 2n);
        });

        it("Should prevent removing more than 100% liquidity", async function () {
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            // Add initial liquidity first
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");
            
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), tokenAmount, daiAmount);

            // Now try to remove more than 100%
            await expect(
                swap.connect(user1).removeLiquidity(await token1.getAddress(), ethers.parseEther("1001"))
            ).to.be.revertedWithCustomError(swap, "InvalidPercentage");
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
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            // Add initial liquidity first
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");
            
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(await token1.getAddress(), tokenAmount, daiAmount);

            // Now try to remove more than 100%
            await expect(
                swap.connect(user1).removeLiquidity(await token1.getAddress(), ethers.parseEther("1001"))
            ).to.be.revertedWithCustomError(swap, "InvalidPercentage");
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

    describe("LP Token Management", function () {
        it("Should create LP token on first liquidity addition", async function () {
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            // Approve tokens
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);

            // Add liquidity and expect LP token creation
            await expect(swap.connect(user1).addLiquidity(
                await token1.getAddress(),
                tokenAmount,
                daiAmount
            )).to.emit(swap, "LPTokenDeployed");

            // Verify LP token exists
            const lpTokenAddress = await swap.lpTokens(await token1.getAddress());
            expect(lpTokenAddress).to.not.equal(ethers.ZeroAddress);

            // Get LP token contract
            const lpToken = await ethers.getContractAt("ERC20", lpTokenAddress);
            
            // Verify LP token details
            expect(await lpToken.symbol()).to.include("PMP-LP");
            expect(await lpToken.balanceOf(user1.address)).to.equal(ethers.parseEther("1000")); // sqrt(1000 * 1000)
        });

        it("Should mint correct LP tokens for subsequent liquidity additions", async function () {
            const { swap, mockDAI, token1, user1, user2 } = await loadFixture(deploySwapFixture);
            
            // First liquidity addition
            const initialTokenAmount = ethers.parseEther("1000");
            const initialDaiAmount = ethers.parseEther("1000");

            await token1.connect(user1).approve(await swap.getAddress(), initialTokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), initialDaiAmount);
            await swap.connect(user1).addLiquidity(
                await token1.getAddress(),
                initialTokenAmount,
                initialDaiAmount
            );

            // Second liquidity addition
            const additionalTokenAmount = ethers.parseEther("500");
            const additionalDaiAmount = ethers.parseEther("500");

            await token1.connect(user2).approve(await swap.getAddress(), additionalTokenAmount);
            await mockDAI.connect(user2).approve(await swap.getAddress(), additionalDaiAmount);
            await swap.connect(user2).addLiquidity(
                await token1.getAddress(),
                additionalTokenAmount,
                additionalDaiAmount
            );

            // Get LP token
            const lpTokenAddress = await swap.lpTokens(await token1.getAddress());
            const lpToken = await ethers.getContractAt("ERC20", lpTokenAddress);

            // Verify LP token balances
            expect(await lpToken.balanceOf(user2.address)).to.equal(ethers.parseEther("500")); // Half of initial LP tokens
        });

        it("Should burn LP tokens and return correct amounts when removing liquidity", async function () {
            const { swap, mockDAI, token1, user1 } = await loadFixture(deploySwapFixture);
            
            // Add liquidity
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(
                await token1.getAddress(),
                tokenAmount,
                daiAmount
            );

            // Get LP token
            const lpTokenAddress = await swap.lpTokens(await token1.getAddress());
            const lpToken = await ethers.getContractAt("ERC20", lpTokenAddress);
            
            const lpBalance = await lpToken.balanceOf(user1.address);
            const halfLpTokens = lpBalance / 2n;

            // Remove half of liquidity
            await expect(swap.connect(user1).removeLiquidity(
                await token1.getAddress(),
                halfLpTokens
            )).to.emit(swap, "LiquidityRemoved")
              .withArgs(await token1.getAddress(), tokenAmount / 2n, daiAmount / 2n);

            // Verify remaining LP tokens
            expect(await lpToken.balanceOf(user1.address)).to.equal(halfLpTokens);
        });

        it("Should fail when trying to remove more LP tokens than owned", async function () {
            const { swap, mockDAI, token1, user1, user2 } = await loadFixture(deploySwapFixture);
            
            // Add liquidity with user1
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(
                await token1.getAddress(),
                tokenAmount,
                daiAmount
            );

            // Try to remove liquidity with user2 who has no LP tokens
            await expect(
                swap.connect(user2).removeLiquidity(
                    await token1.getAddress(),
                    ethers.parseEther("1")
                )
            ).to.be.reverted;
        });
    });

    describe("LP Token Tracking", function () {
        it("Should track all created LP tokens", async function () {
            const { swap, token1, token2, mockDAI, user1 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            // Add liquidity for first token
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(
                await token1.getAddress(),
                tokenAmount,
                daiAmount
            );

            // Add liquidity for second token
            await token2.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(
                await token2.getAddress(),
                tokenAmount,
                daiAmount
            );

            // Get all LP tokens
            const allLPTokens = await swap.getAllLPTokens();
            
            // Verify we have two LP tokens
            expect(allLPTokens.length).to.equal(2);
            
            // Verify these match our stored LP tokens
            expect(allLPTokens[0]).to.equal(await swap.lpTokens(await token1.getAddress()));
            expect(allLPTokens[1]).to.equal(await swap.lpTokens(await token2.getAddress()));
        });

        it("Should correctly report LP token holdings", async function () {
            const { swap, token1, token2, mockDAI, user1, user2 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            // User1 adds liquidity for token1
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(
                await token1.getAddress(),
                tokenAmount,
                daiAmount
            );

            // User2 adds liquidity for token2
            await token2.connect(user2).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user2).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user2).addLiquidity(
                await token2.getAddress(),
                tokenAmount,
                daiAmount
            );

            // Check User1's holdings
            const [user1Tokens, user1Balances] = await swap.getLPTokenHoldings(user1.address);
            expect(user1Tokens.length).to.equal(2);
            expect(user1Balances[0]).to.equal(ethers.parseEther("1000")); // First pool
            expect(user1Balances[1]).to.equal(0); // Second pool

            // Check User2's holdings
            const [user2Tokens, user2Balances] = await swap.getLPTokenHoldings(user2.address);
            expect(user2Tokens.length).to.equal(2);
            expect(user2Balances[0]).to.equal(0); // First pool
            expect(user2Balances[1]).to.equal(ethers.parseEther("1000")); // Second pool
        });

        it("Should show zero balances for addresses with no LP tokens", async function () {
            const { swap, token1, mockDAI, user1, user2 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            // User1 adds liquidity
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(
                await token1.getAddress(),
                tokenAmount,
                daiAmount
            );

            // Check User2's holdings (who hasn't provided any liquidity)
            const [tokens, balances] = await swap.getLPTokenHoldings(user2.address);
            expect(tokens.length).to.equal(1);
            expect(balances[0]).to.equal(0);
        });

        it("Should update holdings after liquidity removal", async function () {
            const { swap, token1, mockDAI, user1 } = await loadFixture(deploySwapFixture);
            
            const tokenAmount = ethers.parseEther("1000");
            const daiAmount = ethers.parseEther("1000");

            // Add liquidity
            await token1.connect(user1).approve(await swap.getAddress(), tokenAmount);
            await mockDAI.connect(user1).approve(await swap.getAddress(), daiAmount);
            await swap.connect(user1).addLiquidity(
                await token1.getAddress(),
                tokenAmount,
                daiAmount
            );

            // Check initial holdings
            let [tokens, balances] = await swap.getLPTokenHoldings(user1.address);
            const initialBalance = balances[0];

            // Remove half of liquidity
            await swap.connect(user1).removeLiquidity(
                await token1.getAddress(),
                initialBalance / 2n
            );

            // Check updated holdings
            [tokens, balances] = await swap.getLPTokenHoldings(user1.address);
            expect(balances[0]).to.equal(initialBalance / 2n);
        });
    });
});