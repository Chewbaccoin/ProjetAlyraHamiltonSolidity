// test/MockDAI.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockDAI", function () {
  let mockDAI, owner, addr1, addr2;

  beforeEach(async function () {
    const MockDAI = await ethers.getContractFactory("MockDAI");
    [owner, addr1, addr2] = await ethers.getSigners();
    mockDAI = await MockDAI.deploy();
  });

  it("Should deploy with initial supply to the owner", async function () {
    const ownerBalance = await mockDAI.balanceOf(owner.address);
    expect(ownerBalance).to.equal(ethers.parseUnits("1000000000", 18));
  });

  it("Should allow the owner to mint tokens", async function () {
    const mintAmount = ethers.parseUnits("500", 18);
    await mockDAI.connect(owner).mint(addr1.address, mintAmount);
    const addr1Balance = await mockDAI.balanceOf(addr1.address);
    expect(addr1Balance).to.equal(mintAmount);
  });

  it("Should revert minting when not called by the owner", async function () {
    const mintAmount = ethers.parseUnits("500", 18);
    await expect(
      mockDAI.connect(addr1).mint(addr2.address, mintAmount)
    ).to.be.reverted;
  });

  it("Should have 18 decimals as DAI", async function () {
    const decimals = await mockDAI.decimals();
    expect(decimals).to.equal(18);
  });

  it("Should reflect minted tokens in total supply", async function () {
    const initialSupply = await mockDAI.totalSupply();
    const mintAmount = ethers.parseUnits("1000", 18);
    await mockDAI.connect(owner).mint(addr1.address, mintAmount);
    const newSupply = await mockDAI.totalSupply();
    expect(newSupply).to.equal(initialSupply + mintAmount);
  });
});
