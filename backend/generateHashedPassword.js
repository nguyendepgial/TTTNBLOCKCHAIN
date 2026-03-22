const bcrypt = require('bcryptjs');

// Mật khẩu của admin
const password = 'adminpassword';

// Mã hóa mật khẩu
bcrypt.hash(password, 10, (err, hashedPassword) => {
  if (err) {
    console.log('Lỗi mã hóa mật khẩu', err);
    return;
  }
  console.log('Mật khẩu đã mã hóa:', hashedPassword);
});
