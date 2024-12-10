// test/ArtistSBT.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArtistSBT", function () {
    let artistSBT;
    let owner;
    let artist1;
    let artist2;
    let nonOwner;

    beforeEach(async function () {
        // Get signers for tests
        [owner, artist1, artist2, nonOwner] = await ethers.getSigners();

        // Deploy contract
        const ArtistSBT = await ethers.getContractFactory("ArtistSBT");
        artistSBT = await ArtistSBT.deploy();
        await artistSBT.waitForDeployment();
        
        // Add this line to initialize the contract
        await artistSBT.initialize();
    });

    describe("Deployment", function () {
        it("should set the correct owner", async function () {
            expect(await artistSBT.owner()).to.equal(owner.address);
        });

        it("should have the correct name and symbol", async function () {
            expect(await artistSBT.name()).to.equal("PumpMusic Artist");
            expect(await artistSBT.symbol()).to.equal("ARTIST");
        });
    });

    describe("Artist Verification", function () {
        it("should allow the owner to verify an artist", async function () {
            await expect(artistSBT.verifyArtist(artist1.address))
                .to.emit(artistSBT, "ArtistVerified")
                .withArgs(artist1.address, 0);

            expect(await artistSBT.isArtist(artist1.address)).to.be.true;
        });

        it("should not allow a non-owner to verify an artist", async function () {
            await expect(
                artistSBT.connect(nonOwner).verifyArtist(artist1.address)
            ).to.be.revertedWithCustomError(artistSBT, "OwnableUnauthorizedAccount");
        });

        it("should not allow verifying an already verified artist", async function () {
            await artistSBT.verifyArtist(artist1.address);
            await expect(
                artistSBT.verifyArtist(artist1.address)
            ).to.be.revertedWith("Artist already verified");
        });
    });

    describe("Artist Revocation", function () {
        beforeEach(async function () {
            await artistSBT.verifyArtist(artist1.address);
        });

        it("should allow the owner to revoke verification", async function () {
            await expect(artistSBT.revokeVerification(artist1.address))
                .to.emit(artistSBT, "VerificationRevoked")
                .withArgs(artist1.address, 0);

            expect(await artistSBT.isArtist(artist1.address)).to.be.false;
        });

        it("should not allow a non-owner to revoke verification", async function () {
            await expect(
                artistSBT.connect(nonOwner).revokeVerification(artist1.address)
            ).to.be.revertedWithCustomError(artistSBT, "OwnableUnauthorizedAccount");
        });

        it("should not allow revoking a non-verified artist", async function () {
            await expect(
                artistSBT.revokeVerification(artist2.address)
            ).to.be.revertedWith("Not a verified artist");
        });
    });

    describe("Consultation Functions", function () {
        beforeEach(async function () {
            await artistSBT.verifyArtist(artist1.address);
        });

        it("should correctly identify verified artists", async function () {
            expect(await artistSBT.isArtist(artist1.address)).to.be.true;
            expect(await artistSBT.isArtist(artist2.address)).to.be.false;
        });

        it("should return the correct tokenId for an artist", async function () {
            expect(await artistSBT.tokenOfOwner(artist1.address)).to.equal(0);
        });

        it("should fail for a tokenId of a non-verified artist", async function () {
            await expect(
                artistSBT.tokenOfOwner(artist2.address)
            ).to.be.revertedWith("Not a verified artist");
        });
    });

    describe("Soulbound Characteristics", function () {
        beforeEach(async function () {
            await artistSBT.verifyArtist(artist1.address);
        });

        it("should not allow token transfers", async function () {
            await expect(
                artistSBT.connect(artist1).transferFrom(artist1.address, artist2.address, 0)
            ).to.be.revertedWith("SBT: transfer not allowed");
        });

        it("should not allow secure token transfers", async function () {
            await expect(
                artistSBT.connect(artist1)["safeTransferFrom(address,address,uint256)"](
                    artist1.address,
                    artist2.address,
                    0
                )
            ).to.be.revertedWith("SBT: transfer not allowed");
        });
    });
}); 