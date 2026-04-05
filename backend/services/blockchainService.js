const { ethers } = require('ethers');
require('dotenv').config();

class BlockchainService {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Connect to blockchain network
            const networkUrl = process.env.BLOCKCHAIN_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY';
            this.provider = new ethers.JsonRpcProvider(networkUrl);

            // Use private key for server-side signing (in production, use secure key management)
            const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('BLOCKCHAIN_PRIVATE_KEY not configured');
            }

            this.signer = new ethers.Wallet(privateKey, this.provider);

            // Contract ABI for NFT Ticket
            const contractABI = [
                "function mintTicket(address to, uint256 ticketId, string memory metadataURI) external",
                "function transferFrom(address from, address to, uint256 tokenId) external",
                "function ownerOf(uint256 tokenId) external view returns (address)",
                "function tokenURI(uint256 tokenId) external view returns (string)",
                "function balanceOf(address owner) external view returns (uint256)",
                "function isApprovedForAll(address owner, address operator) external view returns (bool)",
                "function setApprovalForAll(address operator, bool approved) external",
                "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
                "event TicketMinted(address indexed to, uint256 indexed ticketId, string metadataURI)"
            ];

            const contractAddress = process.env.CONTRACT_ADDRESS;
            if (!contractAddress) {
                throw new Error('CONTRACT_ADDRESS not configured');
            }

            this.contract = new ethers.Contract(contractAddress, contractABI, this.signer);
            this.isInitialized = true;

            console.log('Blockchain service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize blockchain service:', error);
            throw error;
        }
    }

    async mintTicket(toAddress, ticketId, metadataURI) {
        await this.initialize();

        try {
            console.log(`Minting NFT ticket ${ticketId} to ${toAddress}`);

            // Estimate gas
            const gasEstimate = await this.contract.mintTicket.estimateGas(toAddress, ticketId, metadataURI);
            const gasLimit = Math.ceil(Number(gasEstimate) * 1.2); // Add 20% buffer

            // Mint the ticket
            const tx = await this.contract.mintTicket(toAddress, ticketId, metadataURI, {
                gasLimit: gasLimit
            });

            console.log(`Transaction submitted: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

            return {
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                ticketId: ticketId
            };
        } catch (error) {
            console.error('Error minting ticket:', error);
            return {
                success: false,
                error: error.message,
                ticketId: ticketId
            };
        }
    }

    async transferTicket(fromAddress, toAddress, ticketId) {
        await this.initialize();

        try {
            console.log(`Transferring ticket ${ticketId} from ${fromAddress} to ${toAddress}`);

            // Check ownership
            const currentOwner = await this.contract.ownerOf(ticketId);
            if (currentOwner.toLowerCase() !== fromAddress.toLowerCase()) {
                throw new Error('Sender does not own this ticket');
            }

            // Estimate gas
            const gasEstimate = await this.contract.transferFrom.estimateGas(fromAddress, toAddress, ticketId);
            const gasLimit = Math.ceil(Number(gasEstimate) * 1.2);

            // Transfer
            const tx = await this.contract.transferFrom(fromAddress, toAddress, ticketId, {
                gasLimit: gasLimit
            });

            console.log(`Transfer transaction submitted: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`Transfer confirmed in block ${receipt.blockNumber}`);

            return {
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                ticketId: ticketId,
                from: fromAddress,
                to: toAddress
            };
        } catch (error) {
            console.error('Error transferring ticket:', error);
            return {
                success: false,
                error: error.message,
                ticketId: ticketId
            };
        }
    }

    async verifyOwnership(ticketId, expectedOwner) {
        await this.initialize();

        try {
            const owner = await this.contract.ownerOf(ticketId);
            return {
                isValid: owner.toLowerCase() === expectedOwner.toLowerCase(),
                currentOwner: owner,
                expectedOwner: expectedOwner,
                ticketId: ticketId
            };
        } catch (error) {
            console.error('Error verifying ownership:', error);
            return {
                isValid: false,
                error: error.message,
                ticketId: ticketId
            };
        }
    }

    async getTicketMetadata(ticketId) {
        await this.initialize();

        try {
            const metadataURI = await this.contract.tokenURI(ticketId);
            return {
                success: true,
                ticketId: ticketId,
                metadataURI: metadataURI
            };
        } catch (error) {
            console.error('Error getting ticket metadata:', error);
            return {
                success: false,
                error: error.message,
                ticketId: ticketId
            };
        }
    }

    async getBalance(address) {
        await this.initialize();

        try {
            const balance = await this.contract.balanceOf(address);
            return {
                success: true,
                address: address,
                balance: Number(balance)
            };
        } catch (error) {
            console.error('Error getting balance:', error);
            return {
                success: false,
                error: error.message,
                address: address
            };
        }
    }

    // Get current gas price for fee estimation
    async getGasPrice() {
        await this.initialize();

        try {
            const gasPrice = await this.provider.getFeeData();
            return {
                gasPrice: gasPrice.gasPrice?.toString(),
                maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString()
            };
        } catch (error) {
            console.error('Error getting gas price:', error);
            return null;
        }
    }
}

module.exports = new BlockchainService();