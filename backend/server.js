require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./config/database');

// Import routes
const userRoutes = require('./routes/user/userRoutes');          // đăng ký, đăng nhập
const userTicketRoutes = require('./routes/user/ticketRoutes');  // vé của tôi, lịch sử, chuyển nhượng
const userOrderRoutes = require('./routes/user/orderRoutes');    // đặt vé, lịch sử đơn hàng
const paymentRoutes = require('./routes/user/paymentRoutes');    // thanh toán, hoàn tiền
const checkinRoutes = require('./routes/user/checkinRoutes');    // check-in vé
const eventRoutes = require('./routes/admin/eventRoutes');       // public + admin event routes
const adminTicketRoutes = require('./routes/admin/ticketRoutes'); // admin ticket management
const ticketTypeRoutes = require('./routes/admin/ticketTypeRoutes'); // quản lý loại vé

const app = express();

// Cấu hình CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Parse request body
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// =========================
// ROUTES
// =========================

// User auth
app.use('/api/users', userRoutes);

// User ticket routes
app.use('/api/users/tickets', userTicketRoutes);

// User order routes (đặt vé, quản lý đơn hàng)
app.use('/api/users/orders', userOrderRoutes);

// Payment routes
app.use('/api/payments', paymentRoutes);

// Check-in routes
app.use('/api/checkins', checkinRoutes);

// Event routes
// Lưu ý: file eventRoutes nên tự gắn middleware verifyToken/isAdmin
// cho các route admin như POST/PUT/DELETE bên trong file route
app.use('/api/events', eventRoutes);

// Admin ticket management
app.use('/api/admin/tickets', adminTicketRoutes);

// Admin ticket type management
app.use('/api/admin/ticket-types', ticketTypeRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    connection.release();

    return res.status(200).json({
      success: true,
      message: 'Backend is running',
      database: 'Connected',
      port: process.env.PORT || 5000
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  return res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: err.message
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});