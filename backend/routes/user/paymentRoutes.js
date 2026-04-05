const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/auth');
const {
  createPaymentIntent,
  processPayment,
  getPaymentStatus,
  refundPayment,
  handleWebhook
} = require('../../controllers/user/paymentController');

/**
 * POST /api/payments/create-intent
 * Tạo Payment Intent cho Stripe
 * Body: { orderId }
 */
router.post('/create-intent', verifyToken, createPaymentIntent);

/**
 * POST /api/payments/process
 * Xử lý thanh toán với blockchain integration
 * Body: { orderId, paymentIntentId, walletAddress }
 */
router.post('/process', verifyToken, processPayment);

/**
 * GET /api/payments/:orderId/status
 * Lấy trạng thái thanh toán
 */
router.get('/:orderId/status', verifyToken, getPaymentStatus);

/**
 * POST /api/payments/:orderId/refund
 * Hoàn tiền với blockchain burn
 * Body: { reason: "optional refund reason", walletAddress: "optional" }
 */
router.post('/:orderId/refund', verifyToken, refundPayment);

/**
 * POST /api/payments/webhook
 * Stripe webhook handler (không cần auth vì từ Stripe)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
