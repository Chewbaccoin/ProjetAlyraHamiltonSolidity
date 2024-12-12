const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("PumpMusicTokenFactory", function () {
    async function deployFactoryFixture() {
        const [owner, artist1, artist2, nonArtist] = await ethers.getSigners();

        // Deploy MockUSDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();

        // Deploy ArtistSBT
        const ArtistSBT = await ethers.getContractFactory("ArtistSBT");
        const artistSBT = await ArtistSBT.deploy();
        await artistSBT.initialize();

        // Deploy Factory
        const Factory = await ethers.getContractFactory("PumpMusicTokenFactory");
        const factory = await Factory.deploy(await artistSBT.getAddress());

        // Setup: Grant artist role to artist1 and artist2
        await artistSBT.verifyArtist(artist1.address);
        await artistSBT.verifyArtist(artist2.address);

        // Token parameters for testing
        const tokenParams = {
            name: "Test Music Token",
            symbol: "TMT",
            royaltyPercentage: 100, // 1%
            duration: 365 * 24 * 60 * 60, // 1 year
            tokenPrice: ethers.parseUnits("1", 6), // 1 USDC
            usdcAddress: await mockUSDC.getAddress()
        };

        return { 
            factory, 
            artistSBT, 
            mockUSDC, 
            owner, 
            artist1, 
            artist2, 
            nonArtist,
            tokenParams 
        };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { factory, owner } = await loadFixture(deployFactoryFixture);
            expect(await factory.owner()).to.equal(owner.address);
        });

        it("Should set the correct ArtistSBT address", async function () {
            const { factory, artistSBT } = await loadFixture(deployFactoryFixture);
            expect(await factory.artistSBT()).to.equal(await artistSBT.getAddress());
        });
    });

    describe("Token Creation", function () {
        it("Should allow verified artists to create tokens", async function () {
            const { factory, artist1, tokenParams } = await loadFixture(deployFactoryFixture);
            
            await expect(factory.connect(artist1).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.usdcAddress
            )).to.emit(factory, "TokenCreated")
              .withArgs(artist1.address, anyValue);
        });

        it("Should prevent non-artists from creating tokens", async function () {
            const { factory, nonArtist, tokenParams } = await loadFixture(deployFactoryFixture);
            
            await expect(factory.connect(nonArtist).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.usdcAddress
            )).to.be.revertedWith("Only verified artists can create tokens");
        });

        it("Should validate token parameters", async function () {
            const { factory, artist1, tokenParams } = await loadFixture(deployFactoryFixture);
            
            // Test empty name
            await expect(factory.connect(artist1).createToken(
                "",
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.usdcAddress
            )).to.be.revertedWith("Name cannot be empty");

            // Test empty symbol
            await expect(factory.connect(artist1).createToken(
                tokenParams.name,
                "",
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.usdcAddress
            )).to.be.revertedWith("Symbol cannot be empty");

            // Test zero duration
            await expect(factory.connect(artist1).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                0,
                tokenParams.tokenPrice,
                tokenParams.usdcAddress
            )).to.be.revertedWith("Duration must be greater than 0");

            // Test zero token price
            await expect(factory.connect(artist1).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                0,
                tokenParams.usdcAddress
            )).to.be.revertedWith("Token price must be greater than 0");

            // Test zero address for USDC
            await expect(factory.connect(artist1).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                ethers.ZeroAddress
            )).to.be.revertedWith("Invalid USDC address");
        });

        it("Should transfer token ownership to the artist", async function () {
            const { factory, artist1, tokenParams } = await loadFixture(deployFactoryFixture);
            
            const tx = await factory.connect(artist1).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.usdcAddress
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === 'TokenCreated');
            const tokenAddress = event.args[1];
            
            const RoyaltyToken = await ethers.getContractFactory("PumpMusicRoyaltyToken");
            const token = RoyaltyToken.attach(tokenAddress);
            
            expect(await token.owner()).to.equal(artist1.address);
        });
    });

    describe("Token Tracking", function () {
        it("Should correctly track tokens per artist", async function () {
            const { factory, artist1, tokenParams } = await loadFixture(deployFactoryFixture);
            
            // Create two tokens
            await factory.connect(artist1).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.usdcAddress
            );

            await factory.connect(artist1).createToken(
                tokenParams.name + "2",
                tokenParams.symbol + "2",
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.usdcAddress
            );

            const artistTokens = await factory.getArtistTokens(artist1.address);
            expect(artistTokens.length).to.equal(2);
        });

        it("Should track all created tokens globally", async function () {
            const { factory, artist1, artist2, tokenParams } = await loadFixture(deployFactoryFixture);
            
            // Create tokens from different artists
            await factory.connect(artist1).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.usdcAddress
            );

            await factory.connect(artist2).createToken(
                tokenParams.name + "2",
                tokenParams.symbol + "2",
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.usdcAddress
            );

            const allTokens = await factory.getAllTokens();
            expect(allTokens.length).to.equal(2);
        });
    });
});