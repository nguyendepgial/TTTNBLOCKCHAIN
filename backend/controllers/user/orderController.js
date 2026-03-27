const pool = require('../../config/database');
const crypto = require('crypto');

// Try to import QRCode, but fallback if not installed
let QRCode;
try {
  QRCode = require('qrcode');
} catch (err) {
  console.warn('QRCode module not installed. QR code generation will be skipped.');
  QRCode = null;
}

// Hàm generate unique ticket code
const generateTicketCode = (eventId, ticketTypeId) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TK-${eventId}-${ticketTypeId}-${timestamp}${random}`;
};

// Hàm generate order code
const generateOrderCode = () => {
  const date = new Date();
  const dateStr = date.getFullYear() + 
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `ORD${dateStr}${random}`;
};

// Hàm generate QR code (Data URL format) - Optional
const generateQRCode = async (ticketCode) => {
  if (!QRCode) {
    return null; // QR code module not installed
  }
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(ticketCode);
    return qrCodeDataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    return null;
  }
};

// Tạo đơn hàng mới (đặt vé)
exports.createOrder = async (req, res) => {
  const userId = req.user.id;
  const { items } = req.body; // items = [{ticket_type_id, quantity}, ...]

  // Validation
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Cần cung cấp items (danh sách vé muốn mua)'
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Validate all items and get ticket type info
    const ticketTypeMap = new Map();
    let totalAmount = 0;

    for (const item of items) {
      const { ticket_type_id, quantity } = item;

      if (!ticket_type_id || !quantity || quantity <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Mỗi item cần có ticket_type_id và quantity > 0'
        });
      }

      // Lấy thông tin loại vé
      const [ticketTypes] = await connection.query(
        `
        SELECT 
          tt.id,
          tt.event_id,
          tt.name,
          tt.price,
          tt.quantity_total,
          tt.quantity_sold,
          tt.max_per_order,
          tt.transferable,
          tt.sale_start,
          tt.sale_end,
          tt.status
        FROM ticket_types tt
        WHERE tt.id = ?
        LIMIT 1
        `,
        [ticket_type_id]
      );

      if (ticketTypes.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: `Loại vé (ID: ${ticket_type_id}) không tồn tại`
        });
      }

      const ticketType = ticketTypes[0];

      // 2. Kiểm tra status của loại vé
      if (ticketType.status !== 'active') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Loại vé "${ticketType.name}" hiện không còn bán`
        });
      }

      // 3. Kiểm tra thời gian bán
      const now = new Date();
      if (ticketType.sale_start && new Date(ticketType.sale_start) > now) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Loại vé "${ticketType.name}" chưa mở bán`
        });
      }

      if (ticketType.sale_end && new Date(ticketType.sale_end) < now) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Loại vé "${ticketType.name}" đã hết hạn bán`
        });
      }

      // 4. Kiểm tra số lượng
      if (quantity > ticketType.max_per_order) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Chỉ có thể mua tối đa ${ticketType.max_per_order} vé loại "${ticketType.name}" mỗi đơn`
        });
      }

      const available = ticketType.quantity_total - ticketType.quantity_sold;
      if (quantity > available) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Loại vé "${ticketType.name}" chỉ còn ${available} vé`
        });
      }

      // Lưu lại thông tin
      ticketTypeMap.set(ticket_type_id, {
        eventId: ticketType.event_id,
        name: ticketType.name,
        price: parseFloat(ticketType.price),
        quantity,
        available
      });

      totalAmount += parseFloat(ticketType.price) * quantity;
    }

    // 3. Tạo order
    const orderCode = generateOrderCode();
    const [orderResult] = await connection.query(
      `
      INSERT INTO orders
      (order_code, user_id, total_amount, payment_status, order_status, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', 'pending', NOW(), NOW())
      `,
      [orderCode, userId, totalAmount]
    );

    const orderId = orderResult.insertId;

    // 4. Tạo order items và tickets
    const createdTickets = [];
    const orderItems = [];

    for (const item of items) {
      const { ticket_type_id, quantity } = item;
      const ticketInfo = ticketTypeMap.get(ticket_type_id);

      // Insert order item
      const [orderItemResult] = await connection.query(
        `
        INSERT INTO order_items
        (order_id, ticket_type_id, quantity, unit_price, subtotal, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        `,
        [orderId, ticket_type_id, quantity, ticketInfo.price, ticketInfo.price * quantity]
      );

      orderItems.push({
        orderItemId: orderItemResult.insertId,
        ticketTypeId: ticket_type_id,
        ticketTypeName: ticketInfo.name,
        quantity,
        unitPrice: ticketInfo.price,
        subtotal: ticketInfo.price * quantity
      });

      // Generate tickets
      for (let i = 0; i < quantity; i++) {
        const ticketCode = generateTicketCode(ticketInfo.eventId, ticket_type_id);
        const qrCode = await generateQRCode(ticketCode);

        const [ticketResult] = await connection.query(
          `
          INSERT INTO tickets
          (ticket_code, event_id, ticket_type_id, order_id, owner_user_id, qr_code, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
          `,
          [ticketCode, ticketInfo.eventId, ticket_type_id, orderId, userId, qrCode]
        );

        createdTickets.push({
          ticketId: ticketResult.insertId,
          ticketCode,
          ticketTypeName: ticketInfo.name,
          qrCode: qrCode ? 'generated' : 'failed'
        });
      }

      // Update quantity_sold
      await connection.query(
        `
        UPDATE ticket_types
        SET quantity_sold = quantity_sold + ?
        WHERE id = ?
        `,
        [quantity, ticket_type_id]
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Đặt vé thành công. Đơn hàng đang chờ thanh toán.',
      data: {
        orderId,
        orderCode,
        totalAmount,
        status: 'pending',
        paymentStatus: 'pending',
        items: orderItems,
        ticketsGenerated: createdTickets.length,
        tickets: createdTickets
      }
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Order creation error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo đơn hàng',
      error: err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Lấy chi tiết đơn hàng
exports.getOrderDetail = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  const query = `
    SELECT
      o.id,
      o.order_code,
      o.total_amount,
      o.payment_status,
      o.order_status,
      o.payment_method,
      o.payment_reference,
      o.created_at,
      o.updated_at
    FROM orders o
    WHERE o.id = ? AND o.user_id = ?
    LIMIT 1
  `;

  try {
    const [orders] = await pool.query(query, [orderId, userId]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Đơn hàng không tồn tại'
      });
    }

    const order = orders[0];

    // Lấy items
    const itemsQuery = `
      SELECT
        oi.id,
        oi.ticket_type_id,
        oi.quantity,
        oi.unit_price,
        oi.subtotal,
        tt.name AS ticket_type_name
      FROM order_items oi
      INNER JOIN ticket_types tt ON oi.ticket_type_id = tt.id
      WHERE oi.order_id = ?
    `;

    const [items] = await pool.query(itemsQuery, [orderId]);

    // Lấy tickets
    const ticketsQuery = `
      SELECT
        t.id,
        t.ticket_code,
        t.status,
        t.is_used,
        t.used_at,
        tt.name AS ticket_type_name
      FROM tickets t
      INNER JOIN ticket_types tt ON t.ticket_type_id = tt.id
      WHERE t.order_id = ?
      ORDER BY t.created_at
    `;

    const [tickets] = await pool.query(ticketsQuery, [orderId]);

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết đơn hàng thành công',
      data: {
        order,
        items,
        tickets
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết đơn hàng',
      error: err.message
    });
  }
};

// Lấy danh sách đơn hàng của user
exports.getUserOrders = async (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT
      o.id,
      o.order_code,
      o.total_amount,
      o.payment_status,
      o.order_status,
      o.created_at,
      COUNT(t.id) as ticket_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN tickets t ON oi.order_id = t.order_id
    WHERE o.user_id = ?
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `;

  try {
    const [orders] = await pool.query(query, [userId]);

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đơn hàng thành công',
      data: orders
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách đơn hàng',
      error: err.message
    });
  }
};

// Cancel order (chỉ có thể cancel nếu chưa thanh toán)
exports.cancelOrder = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Kiểm tra order
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

    if (order.payment_status === 'paid') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Không thể hủy đơn hàng đã thanh toán. Vui lòng liên hệ support để hoàn tiền.'
      });
    }

    if (order.order_status === 'cancelled') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng đã bị hủy'
      });
    }

    // Update order status
    await connection.query(
      'UPDATE orders SET order_status = "cancelled", updated_at = NOW() WHERE id = ?',
      [orderId]
    );

    // Restore quantity_sold
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

    // Delete tickets (vì chưa thanh toán nên xóa các vé được tạo)
    await connection.query(
      'DELETE t FROM tickets t INNER JOIN order_items oi ON t.order_id = oi.order_id WHERE oi.order_id = ?',
      [orderId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Hủy đơn hàng thành công'
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi khi hủy đơn hàng',
      error: err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
