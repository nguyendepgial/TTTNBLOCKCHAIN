const express = require('express');
const router = express.Router();
const eventController = require('../../controllers/admin/eventController');
const { verifyToken, isAdmin } = require('../../middlewares/auth');

// Lấy danh sách sự kiện (cho tất cả người dùng)
router.get('/', eventController.getEvents);

// Lấy chi tiết sự kiện theo ID (cho tất cả người dùng)
router.get('/:id', eventController.getEventById);

// Tạo sự kiện mới (chỉ admin)
router.post('/', verifyToken, isAdmin, eventController.createEvent);

// Cập nhật sự kiện (chỉ admin)
router.put('/:id', verifyToken, isAdmin, eventController.updateEvent);

// Xóa sự kiện (chỉ admin)
router.delete('/:id', verifyToken, isAdmin, eventController.deleteEvent);

module.exports = router;