const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  console.log("Deploying ConcertTicketNFT contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const ConcertTicketNFT = await ethers.getContractFactory("ConcertTicketNFT");
  const concertTicketNFT = await ConcertTicketNFT.deploy();

  await concertTicketNFT.deployed();

  const contractAddress = concertTicketNFT.address;

  console.log("ConcertTicketNFT deployed to:", contractAddress);
  console.log("Network:", network.name);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deploy failed:", error);
    process.exit(1);
  });