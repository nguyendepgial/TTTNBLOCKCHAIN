# Concert Ticket NFT Smart Contract

NFT Smart Contract cho hệ thống vé concert blockchain sử dụng ERC721 standard.

## 🚀 Tính năng

- ✅ Mint NFT vé concert
- ✅ Transfer vé giữa users
- ✅ Check-in vé tại event (sử dụng 1 lần)
- ✅ Quản lý events và metadata
- ✅ Admin controls (chỉ owner có thể tạo event)

## 📋 Yêu cầu

- Node.js v16+
- npm hoặc yarn
- Infura account (cho testnet/mainnet)
- Ethereum wallet với private key
- ETH để deploy và gas fees

## 🛠️ Setup

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Cấu hình environment variables
```bash
cp .env.example .env
```

Chỉnh sửa `.env` với thông tin thực:
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
PRIVATE_KEY=0x_your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 3. Compile contract
```bash
npm run compile
```

## 🚀 Deployment

### Local testing (Hardhat network)
```bash
npm run deploy:local
```

### Testnet (Sepolia)
```bash
npm run deploy:sepolia
```

### Mainnet (Production)
```bash
npm run deploy:mainnet
```

## 🧪 Testing

```bash
npm test
```

## 📚 API Reference

### Contract Functions

#### Events
- `createEvent(name, description, eventDate, venue)` - Tạo event mới (chỉ owner)
- `getEvent(eventId)` - Lấy thông tin event

#### Tickets
- `mintTicket(to, eventId, ticketType, price, seatInfo)` - Mint NFT vé mới
- `useTicket(tokenId)` - Sử dụng vé (check-in)
- `transferTicket(to, tokenId)` - Transfer vé cho người khác
- `getTicketMetadata(tokenId)` - Lấy metadata của vé

#### Views
- `ownerOf(tokenId)` - Xem chủ sở hữu vé
- `tokenURI(tokenId)` - Lấy metadata URI của NFT

## 🔐 Security

- Contract sử dụng OpenZeppelin ERC721
- Chỉ owner có thể tạo events
- Vé chỉ có thể sử dụng 1 lần
- Transfer bị chặn nếu vé đã sử dụng

## 📊 Gas Optimization

- Sử dụng optimizer với 200 runs
- ViaIR enabled để tránh stack overflow
- Counters library cho token IDs

## 🔍 Verification

Contract sẽ được verify tự động trên Etherscan nếu có `ETHERSCAN_API_KEY`.

## 📝 License

MIT License