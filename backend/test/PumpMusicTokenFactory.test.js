const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("PumpMusicTokenFactory", function () {
    let PumpMusicTokenFactory;
    let factory;
    let owner;
    let artist;
    let artistSBT;
    let mockDAI;
    let nonArtist;
    let tokenParams;

    beforeEach(async function() {
        [owner, artist, nonArtist] = await ethers.getSigners();
        
        // Deploy ArtistSBT first
        const ArtistSBT = await ethers.getContractFactory("ArtistSBT");
        artistSBT = await ArtistSBT.deploy();
        await artistSBT.initialize();

        // Then deploy the factory with the ArtistSBT address
        PumpMusicTokenFactory = await ethers.getContractFactory("PumpMusicTokenFactory");
        factory = await PumpMusicTokenFactory.deploy(await artistSBT.getAddress());

        // Deploy MockDAI
        const MockDAI = await ethers.getContractFactory("MockDAI");
        mockDAI = await MockDAI.deploy();

        // Setup: Grant artist role to artist1 and artist2
        await artistSBT.verifyArtist(artist.address);

        // Token parameters for testing
        tokenParams = {
            name: "Test Music Token",
            symbol: "TMT",
            royaltyPercentage: 100, // 1%
            duration: 365 * 24 * 60 * 60, // 1 year
            tokenPrice: ethers.parseEther("1"), // 1 DAI (18 decimals)
            daiAddress: await mockDAI.getAddress()
        };
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await factory.owner()).to.equal(owner.address);
        });

        it("Should set the correct ArtistSBT address", async function () {
            expect(await factory.artistSBT()).to.equal(await artistSBT.getAddress());
        });
    });

    describe("Token Creation", function () {
        it("Should allow verified artists to create tokens", async function () {
            await expect(factory.connect(artist).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.daiAddress
            )).to.emit(factory, "TokenCreated")
              .withArgs(
                  artist.address,
                  anyValue,
                  tokenParams.name,
                  tokenParams.symbol,
                  tokenParams.royaltyPercentage
              );
        });

        it("Should prevent non-artists from creating tokens", async function () {
            await expect(factory.connect(nonArtist).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.daiAddress
            )).to.be.revertedWith("Only verified artists can create tokens");
        });

        it("Should validate token parameters", async function () {
            // Test empty name
            await expect(factory.connect(artist).createToken(
                "",
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.daiAddress
            )).to.be.revertedWith("Name cannot be empty");

            // Test empty symbol
            await expect(factory.connect(artist).createToken(
                tokenParams.name,
                "",
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.daiAddress
            )).to.be.revertedWith("Symbol cannot be empty");

            // Test zero duration
            await expect(factory.connect(artist).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                0,
                tokenParams.tokenPrice,
                tokenParams.daiAddress
            )).to.be.revertedWith("Duration must be greater than 0");

            // Test zero token price
            await expect(factory.connect(artist).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                0,
                tokenParams.daiAddress
            )).to.be.revertedWith("Token price must be greater than 0");

            // Test zero address for DAI
            await expect(factory.connect(artist).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                ethers.ZeroAddress
            )).to.be.revertedWith("Invalid DAI address");
        });

        it("Should transfer token ownership to the artist", async function () {
            const tx = await factory.connect(artist).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.daiAddress
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === 'TokenCreated');
            const tokenAddress = event.args[1];
            
            const RoyaltyToken = await ethers.getContractFactory("PumpMusicRoyaltyToken");
            const token = RoyaltyToken.attach(tokenAddress);
            
            expect(await token.owner()).to.equal(artist.address);
        });
    });

    describe("Token Tracking", function () {
        it("Should correctly track tokens per artist", async function () {
            // Create two tokens
            await factory.connect(artist).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.daiAddress
            );

            await factory.connect(artist).createToken(
                tokenParams.name + "2",
                tokenParams.symbol + "2",
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.daiAddress
            );

            const artistTokens = await factory.getArtistTokens(artist.address);
            expect(artistTokens.length).to.equal(2);
        });

        it("Should track all created tokens globally", async function () {
            // Create tokens from different artists
            await factory.connect(artist).createToken(
                tokenParams.name,
                tokenParams.symbol,
                tokenParams.royaltyPercentage,
                tokenParams.duration,
                tokenParams.tokenPrice,
                tokenParams.daiAddress
            );

            const allTokens = await factory.getAllTokens();
            expect(allTokens.length).to.equal(1);
        });
    });

    describe("Token Factory Validation", function () {
        it("should validate token parameters correctly", async function () {
            // Test invalid name
            await expect(factory.createToken(
                "",  // empty name
                "SYMBOL",
                100, // royaltyPercentage
                365 * 24 * 60 * 60, // duration
                ethers.parseEther("1"), // tokenPrice
                tokenParams.daiAddress // DAI address
            )).to.be.revertedWith("Name cannot be empty");

            // Test invalid supply
            await expect(factory.connect(artist).createToken(
                "Token",
                "SYMBOL",
                0,  // royaltyPercentage
                365 * 24 * 60 * 60, // duration
                ethers.parseEther("1"), // tokenPrice
                tokenParams.daiAddress // DAI address
            )).to.be.revertedWith("Invalid royalty percentage");

            // Test invalid royalty percentage
            await expect(factory.connect(artist).createToken(
                "Token",
                "SYMBOL",
                0,  // royaltyPercentage (invalid)
                365 * 24 * 60 * 60, // duration
                ethers.parseEther("1"), // tokenPrice
                tokenParams.daiAddress // DAI address
            )).to.be.revertedWith("Invalid royalty percentage");
        });

        it("should track created tokens correctly", async function () {
            // Create multiple tokens
            await factory.connect(artist).createToken(
                "Token1",
                "TK1",
                100, // royaltyPercentage
                365 * 24 * 60 * 60, // duration in seconds
                ethers.parseEther("1"), // tokenPrice
                tokenParams.daiAddress // DAI address
            );

            await factory.connect(artist).createToken(
                "Token2",
                "TK2",
                100, // royaltyPercentage
                365 * 24 * 60 * 60, // duration in seconds
                ethers.parseEther("1"), // tokenPrice
                tokenParams.daiAddress // DAI address
            );

            const artistTokens = await factory.getArtistTokens(artist.address);
            expect(artistTokens).to.have.length(2);
        });
    });
});