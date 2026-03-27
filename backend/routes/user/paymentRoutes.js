const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/auth');
const {
  processPayment,
  getPaymentStatus,
  refundPayment
} = require('../../controllers/user/paymentController');

/**
 * POST /api/payments/process
 * Xử lý thanh toán (Mock)
 * Body: { orderId, paymentMethod }
 */
router.post('/process', verifyToken, processPayment);

/**
 * GET /api/payments/:orderId/status
 * Lấy trạng thái thanh toán
 */
router.get('/:orderId/status', verifyToken, getPaymentStatus);

/**
 * POST /api/payments/:orderId/refund
 * Hoàn tiền
 * Body: { reason: "optional refund reason" }
 */
router.post('/:orderId/refund', verifyToken, refundPayment);

module.exports = router;
