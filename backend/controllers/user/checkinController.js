const pool = require('../../config/database');

// Check in vé tại sự kiện
exports.checkInTicket = async (req, res) => {
  const { ticketCode } = req.body;
  const staffUserId = req.user.id; // Người check in phải là staff hoặc admin

  if (!ticketCode) {
    return res.status(400).json({
      success: false,
      message: 'Cần cung cấp ticket_code'
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Tìm vé theo ticket_code
    const [tickets] = await connection.query(
      `
      SELECT 
        t.id,
        t.ticket_code,
        t.event_id,
        t.status,
        t.is_used,
        t.used_at,
        t.owner_user_id,
        e.title as event_title,
        u.full_name as owner_name,
        tt.name as ticket_type_name
      FROM tickets t
      INNER JOIN events e ON t.event_id = e.id
      INNER JOIN users u ON t.owner_user_id = u.id
      INNER JOIN ticket_types tt ON t.ticket_type_id = tt.id
      WHERE t.ticket_code = ?
      LIMIT 1
      `,
      [ticketCode]
    );

    if (tickets.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Vé không tồn tại'
      });
    }

    const ticket = tickets[0];

    // 2. Kiểm tra vé còn hợp lệ
    if (ticket.status !== 'active') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Vé không hợp lệ (trạng thái: ${ticket.status})`
      });
    }

    // 3. Kiểm tra vé đã được sử dụng chưa
    if (ticket.is_used === 1) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Vé này đã được sử dụng rồi',
        usedAt: ticket.used_at
      });
    }

    // 4. Cập nhật vé: đánh dấu đã sử dụng
    await connection.query(
      `
      UPDATE tickets
      SET is_used = 1, used_at = NOW(), updated_at = NOW()
      WHERE id = ?
      `,
      [ticket.id]
    );

    // 5. Ghi lại check-in record
    await connection.query(
      `
      INSERT INTO checkins
      (ticket_id, event_id, checked_in_by, checkin_time, checkin_method, checkin_status, notes, created_at)
      VALUES (?, ?, ?, NOW(), 'qr', 'success', ?, NOW())
      `,
      [ticket.id, ticket.event_id, staffUserId, 'Check in successful']
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Check in thành công',
      data: {
        ticketCode: ticket.ticket_code,
        ticketType: ticket.ticket_type_name,
        eventTitle: ticket.event_title,
        ownerName: ticket.owner_name,
        checkinTime: new Date()
      }
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Check-in error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi check in vé',
      error: err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Lấy danh sách check in của sự kiện
exports.getEventCheckIns = async (req, res) => {
  const { eventId } = req.params;
  const { date } = req.query; // Filter by date (YYYY-MM-DD)

  try {
    let query = `
      SELECT
        c.id,
        c.ticket_id,
        c.event_id,
        c.checked_in_by,
        c.checkin_time,
        c.checkin_method,
        c.checkin_status,
        t.ticket_code,
        u.full_name as owner_name,
        tt.name as ticket_type_name,
        staff.full_name as checked_in_by_name
      FROM checkins c
      INNER JOIN tickets t ON c.ticket_id = t.id
      INNER JOIN users u ON t.owner_user_id = u.id
      INNER JOIN ticket_types tt ON t.ticket_type_id = tt.id
      LEFT JOIN users staff ON c.checked_in_by = staff.id
      WHERE c.event_id = ?
    `;

    const params = [eventId];

    if (date) {
      query += ` AND DATE(c.checkin_time) = ?`;
      params.push(date);
    }

    query += ` ORDER BY c.checkin_time DESC`;

    const [checkIns] = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách check in thành công',
      data: {
        total: checkIns.length,
        checkIns
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách check in',
      error: err.message
    });
  }
};

// Lấy thống kê check in của sự kiện
exports.getCheckInStats = async (req, res) => {
  const { eventId } = req.params;

  try {
    // Tổng vé
    const [totalTickets] = await pool.query(
      `
      SELECT COUNT(*) as total FROM tickets WHERE event_id = ?
      `,
      [eventId]
    );

    // Vé đã check in
    const [checkedInTickets] = await pool.query(
      `
      SELECT COUNT(*) as total FROM tickets WHERE event_id = ? AND is_used = 1
      `,
      [eventId]
    );

    // Vé chưa check in
    const [notCheckedInTickets] = await pool.query(
      `
      SELECT COUNT(*) as total FROM tickets WHERE event_id = ? AND is_used = 0 AND status = 'active'
      `,
      [eventId]
    );

    const total = totalTickets[0].total;
    const checkedIn = checkedInTickets[0].total;
    const notCheckedIn = notCheckedInTickets[0].total;
    const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      message: 'Lấy thống kê check in thành công',
      data: {
        totalTickets: total,
        checkedIn,
        notCheckedIn,
        percentage: `${percentage}%`
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê check in',
      error: err.message
    });
  }
};
