const pool = require('../../config/database');

// Lấy danh sách loại vé theo event
exports.getTicketTypes = async (req, res) => {
  const { eventId } = req.params;

  try {
    const query = `
      SELECT
        id,
        event_id,
        name,
        description,
        price,
        quantity_total,
        quantity_sold,
        max_per_order,
        transferable,
        sale_start,
        sale_end,
        status,
        (quantity_total - quantity_sold) as available,
        created_at,
        updated_at
      FROM ticket_types
      WHERE event_id = ?
      ORDER BY price ASC
    `;

    const [ticketTypes] = await pool.query(query, [eventId]);

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách loại vé thành công',
      data: ticketTypes
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách loại vé',
      error: err.message
    });
  }
};

// Tạo loại vé mới
exports.createTicketType = async (req, res) => {
  const { eventId } = req.params;
  const {
    name,
    description,
    price,
    quantity_total,
    max_per_order,
    transferable,
    sale_start,
    sale_end
  } = req.body;

  // Validation
  if (!name || !price || !quantity_total) {
    return res.status(400).json({
      success: false,
      message: 'Cần cung cấp name, price, quantity_total'
    });
  }

  if (price < 0 || quantity_total <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Giá và số lượng phải là số dương'
    });
  }

  try {
    // Kiểm tra event tồn tại
    const [events] = await pool.query('SELECT id FROM events WHERE id = ? LIMIT 1', [eventId]);
    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sự kiện không tồn tại'
      });
    }

    const query = `
      INSERT INTO ticket_types
      (event_id, name, description, price, quantity_total, quantity_sold, max_per_order, transferable, sale_start, sale_end, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'active', NOW(), NOW())
    `;

    const [result] = await pool.query(query, [
      eventId,
      name,
      description || null,
      price,
      quantity_total,
      max_per_order || 10,
      transferable !== false ? 1 : 0,
      sale_start || null,
      sale_end || null
    ]);

    return res.status(201).json({
      success: true,
      message: 'Tạo loại vé thành công',
      data: {
        id: result.insertId,
        event_id: eventId,
        name,
        price,
        quantity_total,
        available: quantity_total
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo loại vé',
      error: err.message
    });
  }
};

// Cập nhật loại vé
exports.updateTicketType = async (req, res) => {
  const { ticketTypeId } = req.params;
  const {
    name,
    description,
    price,
    quantity_total,
    max_per_order,
    transferable,
    sale_start,
    sale_end,
    status
  } = req.body;

  try {
    // Kiểm tra loại vé tồn tại
    const [ticketTypes] = await pool.query(
      'SELECT id, quantity_sold FROM ticket_types WHERE id = ? LIMIT 1',
      [ticketTypeId]
    );

    if (ticketTypes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loại vé không tồn tại'
      });
    }

    const ticketType = ticketTypes[0];

    // Validate: quantity_total không được bé hơn quantity_sold
    if (quantity_total && quantity_total < ticketType.quantity_sold) {
      return res.status(400).json({
        success: false,
        message: `Số lượng tổng không được bé hơn số lượng đã bán (${ticketType.quantity_sold})`
      });
    }

    const query = `
      UPDATE ticket_types
      SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        quantity_total = COALESCE(?, quantity_total),
        max_per_order = COALESCE(?, max_per_order),
        transferable = COALESCE(?, transferable),
        sale_start = COALESCE(?, sale_start),
        sale_end = COALESCE(?, sale_end),
        status = COALESCE(?, status),
        updated_at = NOW()
      WHERE id = ?
    `;

    await pool.query(query, [
      name,
      description,
      price,
      quantity_total,
      max_per_order,
      transferable !== undefined ? (transferable ? 1 : 0) : null,
      sale_start,
      sale_end,
      status,
      ticketTypeId
    ]);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật loại vé thành công'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật loại vé',
      error: err.message
    });
  }
};

// Xóa loại vé
exports.deleteTicketType = async (req, res) => {
  const { ticketTypeId } = req.params;

  try {
    // Kiểm tra loại vé tồn tại và chưa có vé nào được bán
    const [ticketTypes] = await pool.query(
      'SELECT id, quantity_sold FROM ticket_types WHERE id = ? LIMIT 1',
      [ticketTypeId]
    );

    if (ticketTypes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loại vé không tồn tại'
      });
    }

    if (ticketTypes[0].quantity_sold > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa loại vé đã có người mua. Hãy thay đổi trạng thái thành inactive.'
      });
    }

    await pool.query('DELETE FROM ticket_types WHERE id = ?', [ticketTypeId]);

    return res.status(200).json({
      success: true,
      message: 'Xóa loại vé thành công'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa loại vé',
      error: err.message
    });
  }
};
