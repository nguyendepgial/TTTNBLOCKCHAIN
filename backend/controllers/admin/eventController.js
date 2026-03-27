const db = require('../../config/database');  // Kết nối cơ sở dữ liệu MySQL

// API lấy danh sách sự kiện
exports.getEvents = async (req, res) => {
  try {
    const query = 'SELECT * FROM events';  // Truy vấn lấy tất cả sự kiện
    const [results] = await db.query(query);  // Dùng async/await để lấy kết quả
    res.status(200).json(results);  // Trả về kết quả sự kiện
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy sự kiện', error: err });  // Xử lý lỗi
  }
};

// API lấy chi tiết sự kiện theo ID
exports.getEventById = (req, res) => {
  const { id } = req.params;  // Lấy ID từ tham số URL
  const query = 'SELECT * FROM events WHERE id = ?';  // Sử dụng `id` thay vì `event_id`
  db.query(query, [id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi khi lấy sự kiện', error: err });
    }
    if (result.length === 0) {
      return res.status(404).json({ message: 'Sự kiện không tìm thấy' });
    }
    res.status(200).json(result[0]);
  });
};

// API lấy chi tiết sự kiện kèm thông tin loại vé (dành cho booking)
exports.getEventWithTickets = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Lấy thông tin sự kiện
    const eventQuery = 'SELECT * FROM events WHERE id = ?';
    const [events] = await db.query(eventQuery, [id]);

    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sự kiện không tìm thấy'
      });
    }

    const event = events[0];

    // Lấy thông tin loại vé
    const ticketTypesQuery = `
      SELECT 
        id,
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
        (quantity_total - quantity_sold) as available
      FROM ticket_types
      WHERE event_id = ? AND status = 'active'
      ORDER BY price ASC
    `;

    const [ticketTypes] = await db.query(ticketTypesQuery, [id]);

    // Tính tổng số vé còn lại
    let totalAvailable = 0;
    let totalSold = 0;
    ticketTypes.forEach(tt => {
      totalAvailable += (tt.quantity_total - tt.quantity_sold);
      totalSold += tt.quantity_sold;
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết sự kiện thành công',
      data: {
        event,
        ticketTypes,
        summary: {
          totalTicketsAvailable: totalAvailable,
          totalTicketsSold: totalSold,
          totalTicketsCapacity: ticketTypes.reduce((sum, tt) => sum + tt.quantity_total, 0),
          hasAvailableTickets: totalAvailable > 0
        }
      }
    });
  } catch (err) {
    console.error('Error fetching event with tickets:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết sự kiện',
      error: err.message
    });
  }
};

exports.createEvent = async (req, res) => {
  const { title, description, location, event_date, checkin_start_time, checkin_end_time, banner_image } = req.body;
  const slug = title ? title.toLowerCase().replace(/\s+/g, '-') : 'default-slug';  // Tạo slug từ title

  // Log tất cả dữ liệu nhận được từ Postman
  console.log('Received Data:', req.body); // Dòng này sẽ in dữ liệu nhận được từ Postman trong terminal

  // Cập nhật câu lệnh INSERT
  const query = 'INSERT INTO events (title, description, location, event_date, checkin_start_time, checkin_end_time, banner_image, status, created_by, slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  try {
    const [result] = await db.query(query, [
      title,
      description,
      location,
      event_date,
      checkin_start_time || null,  // Nếu không có giá trị, sử dụng NULL
      checkin_end_time || null,    // Nếu không có giá trị, sử dụng NULL
      banner_image || null,        // Nếu không có giá trị, sử dụng NULL
      'draft',
      1,
      slug
    ]);

    // Kiểm tra log khi chèn thành công
    console.log('Event Created:', result); // Dòng này sẽ in ra thông tin về sự kiện được tạo

    res.status(201).json({ message: 'Sự kiện đã được tạo', eventId: result.insertId });
  } catch (err) {
    console.error('Error while creating event:', err); // In lỗi nếu có
    res.status(500).json({ message: 'Lỗi khi tạo sự kiện', error: err });
  }
};
//Cập nhật
exports.updateEvent = async (req, res) => {
  const { id } = req.params;  // Lấy ID từ tham số URL
  const { title, description, location, event_date, checkin_start_time, checkin_end_time, banner_image, status } = req.body;

  const query = 'UPDATE events SET title = ?, description = ?, location = ?, event_date = ?, checkin_start_time = ?, checkin_end_time = ?, banner_image = ?, status = ? WHERE id = ?';
  
  try {
    // Thực hiện truy vấn
    const [result] = await db.query(query, [
      title, 
      description, 
      location, 
      event_date, 
      checkin_start_time || null, 
      checkin_end_time || null, 
      banner_image || null, 
      status || 'draft', 
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Sự kiện không tìm thấy' });
    }

    // Trả về thông báo thành công
    res.status(200).json({ message: 'Sự kiện đã được cập nhật' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi cập nhật sự kiện', error: err });
  }
};
//xóa sự kiện
exports.deleteEvent = async (req, res) => {
  const { id } = req.params;  // Lấy ID từ tham số URL

  const query = 'DELETE FROM events WHERE id = ?';

  try {
    // Thực hiện truy vấn xóa
    const [result] = await db.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Sự kiện không tìm thấy' });
    }

    // Trả về thông báo thành công
    res.status(200).json({ message: 'Sự kiện đã được xóa' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi xóa sự kiện', error: err });
  }
};