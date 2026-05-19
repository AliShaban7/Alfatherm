const mongoose = require('mongoose');

let isConnected = false;
let connectionPromise = null;

const connectDB = async () => {
  // Already connected
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  // Connection in progress - wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        dbName: 'alfaterm',
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,  // Reduced from 10s
        socketTimeoutMS: 30000,          // Reduced from 45s
        connectTimeoutMS: 5000,          // New: faster initial connect
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        retryReads: true
      });
      
      isConnected = true;
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      
      // Handle disconnection
      mongoose.connection.on('disconnected', () => {
        isConnected = false;
        connectionPromise = null;
      });
      
    } catch (error) {
      console.error(`MongoDB Connection Error: ${error.message}`);
      isConnected = false;
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
};

module.exports = connectDB;
