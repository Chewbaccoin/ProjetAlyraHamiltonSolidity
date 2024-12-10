const { expect } = require("chai");
const { ethers } = require("hardhat");
const { upgrades } = require("hardhat");

describe("ArtistSBT", function () {
    let artistSBT;
    let owner;
    let artist1;
    let artist2;
    let nonOwner;

    beforeEach(async function () {
        // Récupération des signers pour les tests
        [owner, artist1, artist2] = await ethers.getSigners();

        // Déploiement du contrat
        const ArtistSBT = await ethers.getContractFactory("ArtistSBT");
        artistSBT = await upgrades.deployProxy(ArtistSBT, [], { initializer: 'initialize' });
        await artistSBT.waitForDeployment();
    });

    describe("Déploiement", function () {
        it("devrait définir le bon propriétaire", async function () {
            expect(await artistSBT.owner()).to.equal(owner.address);
        });

        it("devrait avoir le bon nom et symbole", async function () {
            expect(await artistSBT.name()).to.equal("PumpMusic Artist");
            expect(await artistSBT.symbol()).to.equal("ARTIST");
        });
    });

    describe("Vérification d'artiste", function () {
        it("devrait permettre au propriétaire de vérifier un artiste", async function () {
            await expect(artistSBT.verifyArtist(artist1.address))
                .to.emit(artistSBT, "ArtistVerified")
                .withArgs(artist1.address, 0);

            expect(await artistSBT.isArtist(artist1.address)).to.be.true;
        });

        it("ne devrait pas permettre à un non-propriétaire de vérifier un artiste", async function () {
            await expect(
                artistSBT.connect(nonOwner).verifyArtist(artist1.address)
            ).to.be.revertedWithCustomError(artistSBT, "OwnableUnauthorizedAccount");
        });

        it("ne devrait pas permettre de vérifier un artiste déjà vérifié", async function () {
            await artistSBT.verifyArtist(artist1.address);
            await expect(
                artistSBT.verifyArtist(artist1.address)
            ).to.be.revertedWith("Artist already verified");
        });
    });

    describe("Révocation de vérification", function () {
        beforeEach(async function () {
            await artistSBT.verifyArtist(artist1.address);
        });

        it("devrait permettre au propriétaire de révoquer une vérification", async function () {
            await expect(artistSBT.revokeVerification(artist1.address))
                .to.emit(artistSBT, "VerificationRevoked")
                .withArgs(artist1.address, 0);

            expect(await artistSBT.isArtist(artist1.address)).to.be.false;
        });

        it("ne devrait pas permettre à un non-propriétaire de révoquer une vérification", async function () {
            await expect(
                artistSBT.connect(nonOwner).revokeVerification(artist1.address)
            ).to.be.revertedWithCustomError(artistSBT, "OwnableUnauthorizedAccount");
        });

        it("ne devrait pas permettre de révoquer un artiste non vérifié", async function () {
            await expect(
                artistSBT.revokeVerification(artist2.address)
            ).to.be.revertedWith("Not a verified artist");
        });
    });

    describe("Fonctions de consultation", function () {
        beforeEach(async function () {
            await artistSBT.verifyArtist(artist1.address);
        });

        it("devrait correctement identifier les artistes vérifiés", async function () {
            expect(await artistSBT.isArtist(artist1.address)).to.be.true;
            expect(await artistSBT.isArtist(artist2.address)).to.be.false;
        });

        it("devrait retourner le bon tokenId pour un artiste", async function () {
            expect(await artistSBT.tokenOfOwner(artist1.address)).to.equal(0);
        });

        it("devrait échouer pour un tokenId d'artiste non vérifié", async function () {
            await expect(
                artistSBT.tokenOfOwner(artist2.address)
            ).to.be.revertedWith("Not a verified artist");
        });
    });

    describe("Caractéristique Soulbound", function () {
        beforeEach(async function () {
            await artistSBT.verifyArtist(artist1.address);
        });

        it("ne devrait pas permettre le transfert de tokens", async function () {
            await expect(
                artistSBT.connect(artist1).transferFrom(artist1.address, artist2.address, 0)
            ).to.be.revertedWith("SBT: transfer not allowed");
        });

        it("ne devrait pas permettre le transfert sécurisé de tokens", async function () {
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