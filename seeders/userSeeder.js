const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/userModel');

// Đường dẫn đến file JSON chứa dữ liệu mẫu
const userDataPath = './data/users.json';

async function seedUsers() {
  try {
    // Đọc dữ liệu từ file JSON
    const rawData = fs.readFileSync(userDataPath);
    const userData = JSON.parse(rawData);

    await User.deleteMany({});
    await User.insertMany(userData);

    console.log('Dữ liệu mẫu cho bảng "User" đã được tạo thành công.');
    // mongoose.connection.close();
  } catch (error) {
    console.error('Lỗi khi tạo dữ liệu mẫu cho bảng "User":', error);
  }
}

module.exports = seedUsers;

// seedUsers();