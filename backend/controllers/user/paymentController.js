const pool = require('../../config/database');

/**
 * Mock Payment - không xử lý tiền thật
 * Chỉ update order payment_status từ pending → paid
 */
exports.processPayment = async (req, res) => {
  const userId = req.user.id;
  const { orderId, paymentMethod } = req.body;

  if (!orderId || !paymentMethod) {
    return res.status(400).json({
      success: false,
      message: 'Cần cung cấp orderId và paymentMethod'
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Kiểm tra order tồn tại và thuộc về user
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

    // 2. Kiểm tra order status
    if (order.payment_status === 'paid') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng này đã thanh toán rồi'
      });
    }

    if (order.order_status === 'cancelled') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng này đã bị hủy'
      });
    }

    // 3. MOCK PAYMENT: Giả lập thanh toán thành công (90% success rate)
    const isPaymentSuccess = Math.random() < 0.9;

    if (!isPaymentSuccess) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Thanh toán thất bại (simulated failure)'
      });
    }

    // 4. Generate mock payment reference
    const paymentReference = `PAY${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

    // 5. Update order: payment successful
    await connection.query(
      `
      UPDATE orders
      SET 
        payment_status = 'paid',
        order_status = 'confirmed',
        payment_method = ?,
        payment_reference = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [paymentMethod, paymentReference, orderId]
    );

    // 6. Generate mock blockchain ticket IDs
    // In real scenario, này sẽ triệu gọi blockchain API để mint NFT
    const [tickets] = await connection.query(
      `
      SELECT t.id FROM tickets t
      INNER JOIN order_items oi ON t.order_id = oi.order_id
      WHERE oi.order_id = ?
      `,
      [orderId]
    );

    // Update tickets with mock blockchain fields
    for (const ticket of tickets) {
      const mockBlockchainId = `0x${Math.random().toString(16).substr(2, 40)}`;
      const mockMintHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      await connection.query(
        `
        UPDATE tickets
        SET 
          blockchain_ticket_id = ?,
          mint_tx_hash = ?,
          contract_address = '0x742d35Cc6634C0532925a3b844Bc9e7595f42bE',
          updated_at = NOW()
        WHERE id = ?
        `,
        [mockBlockchainId, mockMintHash, ticket.id]
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Thanh toán thành công (Mock)',
      data: {
        orderId,
        paymentStatus: 'paid',
        paymentReference,
        totalAmount: order.total_amount,
        paymentMethod,
        ticketsMinted: tickets.length,
        note: 'This is a mock payment. In production, integrate with real payment gateway.'
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
 * Hoàn tiền (Mock - chỉ update status)
 */
exports.refundPayment = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;
  const { reason } = req.body;

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Kiểm tra order
    const [orders] = await connection.query(
      'SELECT id, payment_status, order_status FROM orders WHERE id = ? AND user_id = ? LIMIT 1',
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

    // 3. Update order: refunded
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

    // 4. Restore ticket quantities
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

    // 5. Mark tickets as invalid
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
        reason: reason || 'User requested refund'
      }
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

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
