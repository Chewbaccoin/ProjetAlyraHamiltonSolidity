const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("LPToken", function () {
    async function deployLPTokenFixture() {
        const [owner, user1, user2] = await ethers.getSigners();
        
        const LPToken = await ethers.getContractFactory("LPToken");
        const lpToken = await LPToken.deploy("PumpMusic LP", "PMP-LP");

        return { lpToken, owner, user1, user2 };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { lpToken, owner } = await loadFixture(deployLPTokenFixture);
            expect(await lpToken.owner()).to.equal(owner.address);
        });

        it("Should set the correct token name and symbol", async function () {
            const { lpToken } = await loadFixture(deployLPTokenFixture);
            expect(await lpToken.name()).to.equal("PumpMusic LP");
            expect(await lpToken.symbol()).to.equal("PMP-LP");
        });

        it("Should start with zero total supply", async function () {
            const { lpToken } = await loadFixture(deployLPTokenFixture);
            expect(await lpToken.totalSupply()).to.equal(0);
        });
    });

    describe("Minting", function () {
        it("Should allow owner to mint tokens", async function () {
            const { lpToken, owner, user1 } = await loadFixture(deployLPTokenFixture);
            const amount = ethers.parseEther("100");

            await expect(lpToken.mint(user1.address, amount))
                .to.emit(lpToken, "Transfer")
                .withArgs(ethers.ZeroAddress, user1.address, amount);

            expect(await lpToken.balanceOf(user1.address)).to.equal(amount);
        });

        it("Should prevent non-owners from minting tokens", async function () {
            const { lpToken, user1, user2 } = await loadFixture(deployLPTokenFixture);
            const amount = ethers.parseEther("100");

            await expect(
                lpToken.connect(user1).mint(user2.address, amount)
            ).to.be.revertedWithCustomError(lpToken, "OwnableUnauthorizedAccount");
        });
    });
});
