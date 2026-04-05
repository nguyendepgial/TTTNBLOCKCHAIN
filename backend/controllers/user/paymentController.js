const pool = require('../../config/database');
const paymentService = require('../../services/paymentService');
const blockchainService = require('../../services/blockchainService');

/**
 * Tạo Payment Intent cho Stripe
 */
exports.createPaymentIntent = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Cần cung cấp orderId'
    });
  }

  try {
    // Kiểm tra order
    const [orders] = await pool.query(
      'SELECT id, payment_status, total_amount FROM orders WHERE id = ? AND user_id = ? LIMIT 1',
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Đơn hàng không tồn tại'
      });
    }

    const order = orders[0];

    if (order.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng này đã thanh toán rồi'
      });
    }

    // Tạo payment intent
    const paymentResult = await paymentService.createPaymentIntent({
      amount: order.total_amount,
      orderId: order.id,
      userId: userId,
      metadata: {
        type: 'ticket_purchase'
      }
    });

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo payment intent',
        error: paymentResult.error
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment intent tạo thành công',
      data: {
        clientSecret: paymentResult.clientSecret,
        paymentIntentId: paymentResult.paymentIntentId,
        amount: paymentResult.amount,
        currency: paymentResult.currency
      }
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo payment intent',
      error: err.message
    });
  }
};

/**
 * Xử lý thanh toán với blockchain integration
 */
exports.processPayment = async (req, res) => {
  const userId = req.user.id;
  const { orderId, paymentIntentId, walletAddress } = req.body;

  if (!orderId || !paymentIntentId || !walletAddress) {
    return res.status(400).json({
      success: false,
      message: 'Cần cung cấp orderId, paymentIntentId và walletAddress'
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Kiểm tra order
    const [orders] = await connection.query(
      'SELECT id, payment_status, order_status, total_amount FROM orders WHERE id = ? AND user_id = ? LIMIT 1',
      [orderId, userId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Đơn hàng không tồn tại'
      });
    }

    const order = orders[0];

    if (order.payment_status === 'paid') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng này đã thanh toán rồi'
      });
    }

    // 2. Kiểm tra payment status từ Stripe
    const paymentStatus = await paymentService.getPaymentStatus(paymentIntentId);
    if (!paymentStatus.success || paymentStatus.status !== 'succeeded') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Thanh toán chưa thành công',
        paymentStatus: paymentStatus.status
      });
    }

    // 3. Lấy danh sách tickets
    const [tickets] = await connection.query(
      `
      SELECT t.id, t.ticket_code FROM tickets t
      INNER JOIN order_items oi ON t.order_id = oi.order_id
      WHERE oi.order_id = ?
      `,
      [orderId]
    );

    // 4. Mint NFTs trên blockchain - ALL OR NOTHING APPROACH
    console.log(`Minting ${tickets.length} NFTs for order ${orderId}`);

    const blockchainResults = [];

    // PHASE 1: Mint tất cả NFTs trước
    for (const ticket of tickets) {
      const metadataURI = `${process.env.BASE_URL || 'https://api.concerttickets.com'}/metadata/${ticket.ticket_code}`;

      const mintResult = await blockchainService.mintTicket(
        walletAddress,
        ticket.id,
        metadataURI
      );

      blockchainResults.push({
        ticketId: ticket.id,
        ticketCode: ticket.ticket_code,
        blockchainResult: mintResult
      });

      // Nếu có 1 vé mint fail → ROLLBACK TOÀN BỘ
      if (!mintResult.success) {
        console.error(`Failed to mint NFT for ticket ${ticket.id}: ${mintResult.error}`);

        // 🚨 ROLLBACK: Refund payment
        try {
          await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: 'requested_by_customer'
          });
          console.log(`Payment refunded for order ${orderId}`);
        } catch (refundError) {
          console.error('Failed to refund payment:', refundError);
        }

        await connection.rollback();
        return res.status(500).json({
          success: false,
          message: 'Blockchain minting failed - payment has been refunded',
          error: mintResult.error,
          failedTicket: ticket.ticket_code
        });
      }
    }

    // PHASE 2: Chỉ khi TẤT CẢ mint thành công thì mới update DB
    console.log('All NFTs minted successfully, updating database...');

    for (const result of blockchainResults) {
      await connection.query(
        `
        UPDATE tickets
        SET
          blockchain_ticket_id = ?,
          mint_tx_hash = ?,
          contract_address = ?,
          status = 'active',
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          result.ticketId.toString(), // tokenId
          result.blockchainResult.transactionHash,
          process.env.CONTRACT_ADDRESS,
          result.ticketId
        ]
      );
    }

    // 5. Update order status
    await connection.query(
      `
      UPDATE orders
      SET
        payment_status = 'paid',
        order_status = 'confirmed',
        payment_method = 'stripe',
        payment_reference = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [paymentIntentId, orderId]
    );

    await connection.commit();

    const successfulMints = blockchainResults.filter(r => r.blockchainResult.success).length;

    return res.status(200).json({
      success: true,
      message: 'Thanh toán và mint NFT thành công',
      data: {
        orderId,
        paymentStatus: 'paid',
        paymentIntentId,
        walletAddress,
        totalTickets: tickets.length,
        successfulMints,
        failedMints: tickets.length - successfulMints,
        blockchainResults: blockchainResults.map(r => ({
          ticketCode: r.ticketCode,
          success: r.blockchainResult.success,
          transactionHash: r.blockchainResult.transactionHash,
          error: r.blockchainResult.error
        }))
      }
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Payment processing error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý thanh toán',
      error: err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Kiểm tra trạng thái thanh toán
 */
exports.getPaymentStatus = async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.id;

  try {
    const [orders] = await pool.query(
      `
      SELECT
        id,
        order_code,
        payment_status,
        payment_method,
        payment_reference,
        total_amount,
        created_at,
        updated_at
      FROM orders
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Đơn hàng không tồn tại'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy trạng thái thanh toán thành công',
      data: orders[0]
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy trạng thái thanh toán',
      error: err.message
    });
  }
};

/**
 * Hoàn tiền với blockchain burn
 */
exports.refundPayment = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;
  const { reason, walletAddress } = req.body;

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Kiểm tra order
    const [orders] = await connection.query(
      'SELECT id, payment_status, order_status, payment_reference FROM orders WHERE id = ? AND user_id = ? LIMIT 1',
      [orderId, userId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Đơn hàng không tồn tại'
      });
    }

    const order = orders[0];

    // 2. Kiểm tra có thể hoàn tiền không
    if (order.payment_status === 'refunded') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng này đã được hoàn tiền rồi'
      });
    }

    if (order.payment_status !== 'paid') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể hoàn tiền cho đơn hàng đã thanh toán'
      });
    }

    // 3. Process Stripe refund
    const refundResult = await paymentService.refundPayment(order.payment_reference);
    if (!refundResult.success) {
      await connection.rollback();
      return res.status(500).json({
        success: false,
        message: 'Không thể hoàn tiền từ Stripe',
        error: refundResult.error
      });
    }

    // 4. TEMPORARILY DISABLE BURN ON BLOCKCHAIN FOR DEMO
    // Burn NFTs on blockchain - TẠM BỎ TRONG DEMO
    console.log(`[DEMO] Skipping blockchain burn for refund - only database update`);

    // if (walletAddress) {
    //   const [tickets] = await connection.query(
    //     'SELECT id, blockchain_ticket_id FROM tickets WHERE order_id = ?',
    //     [orderId]
    //   );

    //   for (const ticket of tickets) {
    //     if (ticket.blockchain_ticket_id) {
    //       const burnResult = await blockchainService.transferTicket(
    //         walletAddress,
    //         '0x000000000000000000000000000000000000dEaD', // burn address
    //         ticket.id
    //       );

    //       if (!burnResult.success) {
    //         console.error(`Failed to burn NFT for ticket ${ticket.id}`);
    //       }
    //     }
    //   }
    // }

    // 5. Update order: refunded (chỉ database)
    await connection.query(
      `
      UPDATE orders
      SET
        payment_status = 'refunded',
        order_status = 'cancelled',
        notes = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [reason || 'User requested refund', orderId]
    );

    // 6. Restore ticket quantities
    const [orderItems] = await connection.query(
      'SELECT ticket_type_id, quantity FROM order_items WHERE order_id = ?',
      [orderId]
    );

    for (const item of orderItems) {
      await connection.query(
        'UPDATE ticket_types SET quantity_sold = quantity_sold - ? WHERE id = ?',
        [item.quantity, item.ticket_type_id]
      );
    }

    // 7. Mark tickets as cancelled
    await connection.query(
      `
      UPDATE tickets
      SET status = 'cancelled', updated_at = NOW()
      WHERE order_id = ?
      `,
      [orderId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Hoàn tiền thành công',
      data: {
        orderId,
        paymentStatus: 'refunded',
        refundId: refundResult.refundId,
        amount: refundResult.amount,
        reason: reason || 'User requested refund'
      }
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Refund processing error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi hoàn tiền',
      error: err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Webhook handler for Stripe events
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const webhookResult = await paymentService.handleWebhook(req.rawBody, sig);

    if (!webhookResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Webhook processing failed',
        error: webhookResult.error
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      eventType: webhookResult.eventType
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(400).json({
      success: false,
      message: 'Webhook signature verification failed'
    });
  }
};