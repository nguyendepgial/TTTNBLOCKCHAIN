require('dotenv').config();  // Đọc các biến môi trường từ file .env
const express = require('express');  // Thư viện Express
const cors = require('cors');  // Thư viện CORS cho phép giao tiếp giữa các domain
const bodyParser = require('body-parser');  // Thư viện để phân tích dữ liệu POST
const pool = require('./config/database');  // Kết nối cơ sở dữ liệu

// Import routes
const userRoutes = require('./routes/user/userRoutes');  // Routes dành cho người dùng
const adminRoutes = require('./routes/admin/eventRoutes');  // Routes dành cho admin (quản lý sự kiện)
const eventRoutes = require('./routes/admin/eventRoutes');  // Routes public cho /api/events

// Import middlewares
const { verifyToken, isAdmin } = require('./middlewares/auth');  // Middleware xác thực và quyền admin

const app = express();

// Cấu hình middleware CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',  // Địa chỉ frontend được phép truy cập
  credentials: true,  // Cho phép cookie hoặc header bảo mật
  optionsSuccessStatus: 200,  // Để hỗ trợ HTTP/2 response cho một số trình duyệt cũ
};

app.use(cors(corsOptions));

// Middleware phân tích dữ liệu JSON và URL-encoded
app.use(bodyParser.json());  // Để phân tích dữ liệu JSON
app.use(bodyParser.urlencoded({ extended: true }));  // Để phân tích URL-encoded data

// Sử dụng route của người dùng và admin
app.use('/api/users', userRoutes);  // Các route dành cho người dùng
app.use('/api/admin', verifyToken, isAdmin, adminRoutes);  // Các route admin cần bảo mật

// Route public cho sự kiện (xem danh sách hoặc chi tiết sự kiện)
app.use('/api/events', eventRoutes);

// API kiểm tra tình trạng server và kết nối cơ sở dữ liệu
app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();  // Kiểm tra kết nối cơ sở dữ liệu
    connection.release();  // Thả kết nối về pool

    res.json({
      success: true,
      message: 'Backend is running',  // Trả về trạng thái server hoạt động
      database: 'Connected',  // Trả về thông tin kết nối cơ sở dữ liệu
      port: process.env.PORT || 5000  // Trả về cổng đang chạy của server
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',  // Thông báo lỗi nếu không kết nối được database
      error: error.message  // Lỗi chi tiết
    });
  }
});

// API không tìm thấy route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'  // Thông báo lỗi nếu không tìm thấy route
  });
});

// Xử lý lỗi bất kỳ không mong muốn
app.use((err, req, res, next) => {
  console.error(err.stack);  // Log lỗi cho developer
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: err.message
  });
});

// Lắng nghe và chạy server
const PORT = process.env.PORT || 5000;  // Lấy cổng từ biến môi trường hoặc mặc định là 5000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);  // Thông báo server đã chạy thành công
});