const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middlewares/auth');
const {
  checkInTicket,
  getEventCheckIns,
  getCheckInStats
} = require('../../controllers/user/checkinController');

/**
 * POST /api/checkins/check-in
 * Check in vé tại sự kiện (staff/admin only)
 * Body: { ticketCode: "TK-..." }
 */
router.post('/check-in', verifyToken, checkInTicket);

/**
 * GET /api/checkins/events/:eventId
 * Lấy danh sách check in của sự kiện (admin only)
 * Query: ?date=YYYY-MM-DD (optional)
 */
router.get('/events/:eventId', verifyToken, isAdmin, getEventCheckIns);

/**
 * GET /api/checkins/events/:eventId/stats
 * Lấy thống kê check in (admin only)
 */
router.get('/events/:eventId/stats', verifyToken, isAdmin, getCheckInStats);

module.exports = router;
