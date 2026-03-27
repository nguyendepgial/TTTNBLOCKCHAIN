const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/auth');
const {
  createOrder,
  getOrderDetail,
  getUserOrders,
  cancelOrder
} = require('../../controllers/user/orderController');

/**
 * POST /api/users/orders/create
 * Tạo đơn hàng (đặt vé)
 * Body: { items: [{ticket_type_id, quantity}, ...] }
 */
router.post('/create', verifyToken, createOrder);

/**
 * GET /api/users/orders
 * Lấy danh sách đơn hàng của user
 */
router.get('/', verifyToken, getUserOrders);

/**
 * GET /api/users/orders/:orderId
 * Lấy chi tiết đơn hàng
 */
router.get('/:orderId', verifyToken, getOrderDetail);

/**
 * POST /api/users/orders/:orderId/cancel
 * Hủy đơn hàng (chỉ nếu chưa thanh toán)
 */
router.post('/:orderId/cancel', verifyToken, cancelOrder);

module.exports = router;
