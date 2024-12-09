// scripts/deploy.js
const hre = require("hardhat");

async function main() {
    console.log("Starting deployment...");

    // Get deployment accounts
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Deploy MockUSDC first (for testnet only)
    console.log("\nDeploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    console.log("MockUSDC deployed to:", await mockUSDC.getAddress());

    // Deploy the Factory
    console.log("\nDeploying PumpMusicTokenFactory...");
    const PumpMusicTokenFactory = await ethers.getContractFactory("PumpMusicTokenFactory");
    const factory = await PumpMusicTokenFactory.deploy();
    await factory.waitForDeployment();
    console.log("PumpMusicTokenFactory deployed to:", await factory.getAddress());

    // Deploy the Swap contract
    console.log("\nDeploying PumpMusicSwap...");
    const PumpMusicSwap = await ethers.getContractFactory("PumpMusicSwap");
    const swap = await PumpMusicSwap.deploy(await mockUSDC.getAddress());
    await swap.waitForDeployment();
    console.log("PumpMusicSwap deployed to:", await swap.getAddress());

    // Deploy an example token through the factory (optional, for testing)
    console.log("\nCreating an example token...");
    const createTokenTx = await factory.createToken(
        "Example Artist Token",
        "EAT",
        100, // 0.001% royalty
        365 * 24 * 60 * 60, // 1 year duration
        ethers.parseUnits("1", 6), // 1 USDC price
        await mockUSDC.getAddress()
    );
    const receipt = await createTokenTx.wait();
    
    // Get the token address from event logs
    const tokenCreatedEvent = receipt.logs.find(
        log => log.eventName === 'TokenCreated'
    );
    const tokenAddress = tokenCreatedEvent.args.tokenAddress;
    console.log("Example token deployed to:", tokenAddress);

    // Print all deployment addresses for verification
    console.log("\nDeployment Summary:");
    console.log("====================");
    console.log("MockUSDC:", await mockUSDC.getAddress());
    console.log("Factory:", await factory.getAddress());
    console.log("Swap:", await swap.getAddress());
    console.log("Example Token:", tokenAddress);

    // Verify contracts on Etherscan
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("\nVerifying contracts on Etherscan...");
        
        // Verify MockUSDC
        await hre.run("verify:verify", {
            address: await mockUSDC.getAddress(),
            constructorArguments: []
        });

        // Verify Factory
        await hre.run("verify:verify", {
            address: await factory.getAddress(),
            constructorArguments: []
        });

        // Verify Swap
        await hre.run("verify:verify", {
            address: await swap.getAddress(),
            constructorArguments: [await mockUSDC.getAddress()]
        });
    }
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });