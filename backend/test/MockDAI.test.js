// test/MockDAI.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockDAI", function () {
    let mockDAI;
    let owner;
    let addr1;
    let addr2;
    const INITIAL_SUPPLY = ethers.parseUnits("1000000000", 18);
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    beforeEach(async function () {
        const MockDAI = await ethers.getContractFactory("MockDAI");
        [owner, addr1, addr2] = await ethers.getSigners();
        mockDAI = await MockDAI.deploy();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await mockDAI.owner()).to.equal(owner.address);
        });

        it("Should assign the total supply of tokens to the owner", async function () {
            const ownerBalance = await mockDAI.balanceOf(owner.address);
            expect(ownerBalance).to.equal(INITIAL_SUPPLY);
        });
    });

    describe("Minting", function () {
        it("Should allow owner to mint tokens", async function () {
            const mintAmount = ethers.parseUnits("500", 18);
            await mockDAI.connect(owner).mint(addr1.address, mintAmount);
            expect(await mockDAI.balanceOf(addr1.address)).to.equal(mintAmount);
        });

        it("Should revert when non-owner tries to mint", async function () {
            const mintAmount = ethers.parseUnits("500", 18);
            await expect(
                mockDAI.connect(addr1).mint(addr2.address, mintAmount)
            ).to.be.reverted;
        });

        it("Should revert when minting to zero address", async function () {
            const mintAmount = ethers.parseUnits("500", 18);
            await expect(
                mockDAI.connect(owner).mint(ZERO_ADDRESS, mintAmount)
            ).to.be.revertedWith("MockDAI: mint to the zero address");
        });

        it("Should update total supply after minting", async function () {
            const mintAmount = ethers.parseUnits("1000", 18);
            await mockDAI.connect(owner).mint(addr1.address, mintAmount);
            expect(await mockDAI.totalSupply()).to.equal(INITIAL_SUPPLY + mintAmount);
        });
    });

    describe("Token properties", function () {
        it("Should have correct name and symbol", async function () {
            expect(await mockDAI.name()).to.equal("DAI Coin");
            expect(await mockDAI.symbol()).to.equal("DAI");
        });

        it("Should have 18 decimals", async function () {
            expect(await mockDAI.decimals()).to.equal(18);
        });
    });
});
