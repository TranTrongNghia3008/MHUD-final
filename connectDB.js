const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://admin:fQoVQrqz48aeTWM6@mhud-final.vzv7o0j.mongodb.net/Kallie-v01?retryWrites=true&w=majority&appName=MHUD-final', {
      // useNewUrlParser: true,
      // useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
