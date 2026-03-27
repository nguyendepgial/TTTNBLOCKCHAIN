const express = require('express');
const router = express.Router();
const eventController = require('../../controllers/admin/eventController');
const { verifyToken, isAdmin } = require('../../middlewares/auth');

/*
|--------------------------------------------------------------------------
| PUBLIC ROUTES
|--------------------------------------------------------------------------
| Các route này ai cũng xem được: user, admin, guest
*/

// Lấy danh sách sự kiện
router.get('/', eventController.getEvents);

// Lấy chi tiết sự kiện với loại vé (dành cho booking)
router.get('/:id/details', eventController.getEventWithTickets);

// Lấy chi tiết sự kiện theo ID
router.get('/:id', eventController.getEventById);

/*
|--------------------------------------------------------------------------
| ADMIN ROUTES
|--------------------------------------------------------------------------
| Các route này chỉ admin mới được thao tác
*/

// Tạo sự kiện mới
router.post('/', verifyToken, isAdmin, eventController.createEvent);

// Cập nhật sự kiện
router.put('/:id', verifyToken, isAdmin, eventController.updateEvent);

// Xóa sự kiện
router.delete('/:id', verifyToken, isAdmin, eventController.deleteEvent);

module.exports = router;