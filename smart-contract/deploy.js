const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying ConcertTicketNFT contract...");

  // Get the contract factory
  const ConcertTicketNFT = await ethers.getContractFactory("ConcertTicketNFT");

  // Deploy the contract
  const concertTicketNFT = await ConcertTicketNFT.deploy();

  // Wait for deployment to finish
  await concertTicketNFT.waitForDeployment();

  const contractAddress = await concertTicketNFT.getAddress();

  console.log("ConcertTicketNFT deployed to:", contractAddress);

  // Verify contract on Etherscan (optional)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: network.name,
    deployer: (await ethers.getSigners())[0].address,
    deployedAt: new Date().toISOString(),
    abi: concertTicketNFT.interface.format('json')
  };

  console.log("Deployment completed!");
  console.log("Contract Address:", contractAddress);
  console.log("Network:", network.name);

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });