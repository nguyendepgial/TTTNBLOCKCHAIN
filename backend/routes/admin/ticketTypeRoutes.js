const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middlewares/auth');
const {
  getTicketTypes,
  createTicketType,
  updateTicketType,
  deleteTicketType
} = require('../../controllers/admin/ticketTypeController');

/**
 * GET /api/events/:eventId/ticket-types
 * Lấy danh sách loại vé theo sự kiện (public)
 */
router.get('/events/:eventId/ticket-types', getTicketTypes);

/**
 * POST /api/admin/ticket-types/:eventId
 * Tạo loại vé mới (admin only)
 */
router.post('/:eventId', verifyToken, isAdmin, createTicketType);

/**
 * PUT /api/admin/ticket-types/:ticketTypeId
 * Cập nhật loại vé (admin only)
 */
router.put('/:ticketTypeId', verifyToken, isAdmin, updateTicketType);

/**
 * DELETE /api/admin/ticket-types/:ticketTypeId
 * Xóa loại vé (admin only)
 */
router.delete('/:ticketTypeId', verifyToken, isAdmin, deleteTicketType);

module.exports = router;
