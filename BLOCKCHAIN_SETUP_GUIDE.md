# HƯỚNG DẪN SETUP BLOCKCHAIN - FLOW ĐƠN GIẢN CHO ĐỒ ÁN

## 🎯 FLOW CHÍNH CỦA ĐỒ ÁN

```
User chọn vé → Tạo order → Thanh toán thành công → Backend mint NFT → Lưu tx hash vào DB → Frontend hiển thị vé có thông tin blockchain
```

**Nguyên tắc**: Web2 xử lý business logic, Blockchain chỉ xác nhận và lưu trữ vé NFT.

---

## 🏗️ BƯỚC 1: SỬA SMART CONTRACT (ĐƠN GIẢN HÓA)

### Sửa `mintTicket` function trong `ConcertTicketNFT.sol`:

**Trước (6 tham số - phức tạp)**:
```solidity
function mintTicket(
    address to,
    uint256 ticketId,
    string memory eventName,
    string memory seat,
    uint256 price,
    string memory ticketType
)
```

**Sau (3 tham số - đơn giản)**:
```solidity
function mintTicket(
    address to,
    uint256 ticketId,
    string memory metadataURI
) external onlyOwner
```

**Lý do thay đổi**:
- ✅ Backend đã thiết kế theo hướng này
- ✅ Dễ gọi từ `blockchainService.js`
- ✅ Dễ demo và bảo vệ
- ✅ Không cần query thêm dữ liệu event/ticketType

### Metadata Strategy:
- **MySQL lưu**: event name, seat, price, loại vé, owner info
- **Blockchain lưu**: chỉ tokenId, owner address, metadataURI (tham chiếu)

---

## 🔧 BƯỚC 2: SỬA BACKEND PAYMENT CONTROLLER

### Rule mới: **ALL OR NOTHING**

```javascript
// Trong paymentController.js - processPayment()

// 1. Mint tất cả NFTs trước
const blockchainResults = [];
for (const ticket of tickets) {
    const mintResult = await blockchainService.mintTicket(
        userWalletAddress,
        ticket.id,
        `ipfs://metadata/${ticket.id}` // hoặc simple URI
    );

    if (!mintResult.success) {
        // 🚨 ROLLBACK TOÀN BỘ: refund payment + cancel order
        await stripe.refunds.create({ payment_intent: paymentIntentId });
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: 'Blockchain minting failed - payment refunded'
        });
    }

    blockchainResults.push(mintResult);
}

// 2. Chỉ khi TẤT CẢ mint thành công thì mới update DB
for (let i = 0; i < tickets.length; i++) {
    await connection.query(`
        UPDATE tickets SET
            blockchain_ticket_id = ?,
            mint_tx_hash = ?,
            contract_address = ?,
            status = 'active'
        WHERE id = ?
    `, [
        tickets[i].id,
        blockchainResults[i].transactionHash,
        process.env.CONTRACT_ADDRESS,
        tickets[i].id
    ]);
}
```

---

## 📊 BƯỚC 3: ĐƠN GIẢN HÓA QUERY TICKETS

**Trước (join phức tạp)**:
```sql
SELECT t.*, e.title, tt.name, u.full_name
FROM tickets t
INNER JOIN events e ON t.event_id = e.id
INNER JOIN ticket_types tt ON t.ticket_type_id = tt.id
INNER JOIN users u ON t.owner_user_id = u.id
WHERE t.order_id = ?
```

**Sau (đơn giản)**:
```sql
SELECT id, ticket_code, owner_user_id
FROM tickets
WHERE order_id = ?
```

**Lý do**: Chỉ cần data tối thiểu để mint NFT.

---

## 🚫 BƯỚC 4: TẠM BỎ TRANSFER ON-CHAIN

**Hiện tại**: `transferTicket()` dễ fail vì server wallet không phải owner thật.

**Giải pháp**: Không demo transfer on-chain trong đồ án.

**Câu trả lời khi cô hỏi**:
> "Hệ thống đã thiết kế service cho chuyển nhượng on-chain, nhưng trong phạm vi demo em ưu tiên hoàn thiện mint NFT sau thanh toán."

---

## 🚫 BƯỚC 5: TẠM BỎ BURN KHI REFUND

**Hiện tại**: Contract chưa có hàm burn riêng sạch sẽ.

**Giải pháp**: Refund chỉ xử lý backend + DB.

**Câu trả lời khi cô hỏi**:
> "Phần refund blockchain là hướng mở rộng tiếp theo, hiện tại em ưu tiên flow phát hành vé on-chain sau thanh toán."

---

## ⚙️ BƯỚC 6: SETUP BLOCKCHAIN INFRA

### 1. Tạo Infura Account
1. Truy cập https://infura.io
2. Tạo project "Concert Ticket NFT"
3. Copy Project ID

### 2. Tạo Wallet
```bash
# Tạo wallet mới
cd smart-contract
node -e "
const ethers = require('ethers');
const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
"
```

### 3. Fund Wallet (Sepolia Testnet)
- Faucet: https://sepoliafaucet.com
- Nhận 0.5 ETH miễn phí

### 4. Deploy Contract
```bash
# Compile & Deploy
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

### 5. Cập nhật Backend .env
```env
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
BLOCKCHAIN_PRIVATE_KEY=0x_your_private_key
CONTRACT_ADDRESS=0x_deployed_contract_address
```

---

## 🧪 BƯỚC 7: TEST FLOW ĐƠN GIẢN

### 1. Start Local Blockchain (Development)
```bash
cd smart-contract
npx hardhat node
```

### 2. Deploy Local Contract
```bash
npx hardhat run scripts/deploy.js --network hardhat
```

### 3. Update .env cho Local
```env
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=0x_your_local_contract_address
```

### 4. Test Mint NFT
```bash
# Start backend
cd ../backend
npm start

# Test payment flow
curl -X POST http://localhost:5000/api/payments/process-payment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"orderId": 1}'
```

---

## 🏛️ KIẾN TRÚC CUỐI CÙNG

| **Web2 (MySQL + Express)** | **Blockchain (Ethereum)** |
|---------------------------|---------------------------|
| User authentication | NFT minting sau thanh toán |
| Event management | Transaction hash storage |
| Ticket types | Ownership verification |
| Order processing | Immutable ticket records |
| Payment processing | Decentralized validation |
| Check-in system | Anti-fraud protection |
| Admin dashboard |  |

**Nguyên tắc**: Blockchain hỗ trợ và tăng cường Web2 system, không thay thế hoàn toàn.

---

## 🎯 LỢI ÍCH CỦA FLOW NÀY

✅ **Đơn giản**: Chỉ focus vào core feature - mint NFT sau payment
✅ **Stable**: Ít lỗi, dễ debug
✅ **Demo-friendly**: Dễ giải thích flow cho cô giáo
✅ **Production-ready**: Dễ mở rộng thêm features sau
✅ **Secure**: All-or-nothing approach tránh inconsistent state
✅ **Cost-effective**: Ít gas usage, metadata ở off-chain

---

## 🚨 LƯU Ý QUAN TRỌNG

- 🔐 **Private Key**: Không commit vào git, chỉ dùng cho dev/test
- 💰 **Gas Fees**: Testnet free, mainnet cần ETH
- 🧪 **Test First**: Luôn test local trước khi deploy testnet
- 📊 **Monitor**: Check transactions trên Etherscan
- 🔄 **Backup**: Lưu mnemonic phrase của wallet

---

## ❓ CÂU HỎI THƯỜNG GẶP

**Q: Tại sao không transfer on-chain?**
> Vì server wallet không phải owner thật của user NFT, dễ fail. Demo tập trung vào mint NFT.

**Q: Tại sao không burn khi refund?**
> Contract chưa optimize cho burn. Refund xử lý Web2 trước, blockchain mở rộng sau.

**Q: Metadata lưu ở đâu?**
> Chi tiết (event name, seat, price) lưu MySQL. Blockchain chỉ lưu tokenId + metadataURI tham chiếu.

**Q: Nếu 1 vé mint fail thì sao?**
> Rollback toàn bộ: refund payment + cancel order. All or nothing approach.