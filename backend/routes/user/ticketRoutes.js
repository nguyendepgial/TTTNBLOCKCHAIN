const express = require('express');
const router = express.Router();
const { getTicketHistory, transferTicket } = require('../../controllers/user/ticketController');
const { verifyToken } = require('../../middlewares/auth');

// Lịch sử mua vé của người dùng
router.get('/history', verifyToken, getTicketHistory);

// Chuyển nhượng vé
router.post('/transfer', verifyToken, transferTicket);

module.exports = router;