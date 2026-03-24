const express = require('express');
const router = express.Router();
const { reissueTicket, updateTicketStatus } = require('../../controllers/admin/ticketController');
const { verifyToken, isAdmin } = require('../../middlewares/auth');

// Cấp lại vé (chỉ admin)
router.put('/reissue', verifyToken, isAdmin, reissueTicket);

// Thay đổi trạng thái vé (chỉ admin)
router.put('/status', verifyToken, isAdmin, updateTicketStatus);

module.exports = router;