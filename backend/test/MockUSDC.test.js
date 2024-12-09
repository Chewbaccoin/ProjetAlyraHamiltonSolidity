const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockUSDC", function () {
  let mockUSDC, owner, addr1, addr2;

  beforeEach(async function () {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    [owner, addr1, addr2] = await ethers.getSigners();
    mockUSDC = await MockUSDC.deploy();
  });

  it("Should deploy with initial supply to the owner", async function () {
    const ownerBalance = await mockUSDC.balanceOf(owner.address);
    expect(ownerBalance).to.equal(ethers.parseUnits("1000000", 6));
  });

  it("Should allow the owner to mint tokens", async function () {
    const mintAmount = ethers.parseUnits("500", 6);
    await mockUSDC.connect(owner).mint(addr1.address, mintAmount);
    const addr1Balance = await mockUSDC.balanceOf(addr1.address);
    expect(addr1Balance).to.equal(mintAmount);
  });

  it("Should revert minting when not called by the owner", async function () {
    const mintAmount = ethers.parseUnits("500", 6);
    await expect(
      mockUSDC.connect(addr1).mint(addr2.address, mintAmount)
    ).to.be.reverted;
  });

  it("Should have 6 decimals as USDC", async function () {
    const decimals = await mockUSDC.decimals();
    expect(decimals).to.equal(6);
  });

  it("Should reflect minted tokens in total supply", async function () {
    const initialSupply = await mockUSDC.totalSupply();
    const mintAmount = ethers.parseUnits("1000", 6);
    await mockUSDC.connect(owner).mint(addr1.address, mintAmount);
    const newSupply = await mockUSDC.totalSupply();
    expect(newSupply).to.equal(initialSupply + mintAmount);
  });
});
