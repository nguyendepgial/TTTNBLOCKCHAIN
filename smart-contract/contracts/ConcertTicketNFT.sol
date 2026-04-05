// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ConcertTicketNFT is ERC721, Ownable {
    // Mapping để track ticket đã được sử dụng
    mapping(uint256 => bool) public ticketUsed;

    // Events
    event TicketMinted(address indexed to, uint256 indexed tokenId, string metadataURI);
    event TicketUsed(uint256 indexed tokenId, address indexed usedBy);
    event TicketTransferred(uint256 indexed tokenId, address indexed from, address indexed to);

    constructor() ERC721("ConcertTicketNFT", "CTNFT") {}

    // Mint ticket NFT - ĐƠN GIẢN HÓA: chỉ 3 tham số
    function mintTicket(
        address to,
        uint256 ticketId,
        string memory metadataURI
    ) external onlyOwner {
        require(_ownerOf(ticketId) == address(0), "Token ID already exists");

        _safeMint(to, ticketId);

        emit TicketMinted(to, ticketId, metadataURI);
    }

    // Mark ticket as used (check-in) - ĐƠN GIẢN HÓA
    function useTicket(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(!ticketUsed[tokenId], "Ticket already used");

        ticketUsed[tokenId] = true;

        emit TicketUsed(tokenId, ownerOf(tokenId));
    }

    // Override transfer function to emit custom event
    function transferFrom(address from, address to, uint256 tokenId) public override {
        super.transferFrom(from, to, tokenId);
        emit TicketTransferred(tokenId, from, to);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public override {
        super.safeTransferFrom(from, to, tokenId);
        emit TicketTransferred(tokenId, from, to);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override {
        super.safeTransferFrom(from, to, tokenId, data);
        emit TicketTransferred(tokenId, from, to);
    }

    // Simple tokenURI - metadata lưu ở off-chain (MySQL/IPFS)
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        // Return simple metadata URI - thực tế sẽ query từ backend
        return string(abi.encodePacked(
            "https://api.concerttickets.com/metadata/",
            uint2str(tokenId)
        ));
    }

    // Utility function
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }

        uint256 j = _i;
        uint256 len;

        while (j != 0) {
            len++;
            j /= 10;
        }

        bytes memory bstr = new bytes(len);
        uint256 k = len;

        while (_i != 0) {
            k = k - 1;
            uint8 temp = uint8(48 + (_i % 10));
            bstr[k] = bytes1(temp);
            _i /= 10;
        }

        return string(bstr);
    }
}