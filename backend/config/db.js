const dns = require('dns');
const mongoose = require('mongoose');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;
const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1']; // Google, Cloudflare

/**
 * "mongodb+srv://" URIs need a DNS SRV lookup. Some Windows setups, VPNs and
 * campus networks point Node at a resolver that refuses SRV queries
 * (querySrv ECONNREFUSED) even though the browser works fine. If that happens,
 * switch Node's resolver to public DNS before connecting.
 */
async function ensureSrvResolvable(uri) {
  if (!uri || !uri.startsWith('mongodb+srv://')) return;
  const host = uri.replace(/^mongodb\+srv:\/\/([^@]*@)?/, '').split(/[/?]/)[0];
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch (err) {
    console.warn(`DNS SRV lookup failed (${err.code}) - retrying with public DNS ${PUBLIC_DNS.join(', ')}`);
    dns.setServers(PUBLIC_DNS);
  }
}

/**
 * Connect to MongoDB Atlas with retry on start-up (NFR-10).
 * After the first successful connection Mongoose handles auto-reconnect itself.
 */
async function connectDB(uri = process.env.MONGO_URI, attempt = 1) {
  try {
    if (attempt === 1) await ensureSrvResolvable(uri);
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
