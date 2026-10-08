const mongoose = require('mongoose');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

/**
 * Connect to MongoDB Atlas with retry on start-up (NFR-10).
 * After the first successful connection Mongoose handles auto-reconnect itself.
 */
async function connectDB(uri = process.env.MONGO_URI, attempt = 1) {
  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    // Do not print the URI - it contains credentials (NFR-22)
    console.error(`MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}`);
    if (attempt >= MAX_RETRIES) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return connectDB(uri, attempt + 1);
  }
}

mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected - Mongoose will try to reconnect'));
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));

module.exports = connectDB;
