require('dotenv').config();

// Fail fast if the JWT secret is missing — otherwise jwt.sign throws only at the
// first login (and jwt.verify accepts nothing), which is much harder to diagnose
// than a clear startup error.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET təyin olunmayıb. .env faylını yoxlayın.');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const connectDB = require('./config/db');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(compression()); // Compress responses
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Connect to DB once at startup (non-blocking for health check)
let dbReady = false;
connectDB()
  .then(() => { dbReady = true; })
  .catch(err => console.error('Initial DB connection failed:', err.message));

// Fast health check (doesn't wait for DB)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', db: dbReady ? 'connected' : 'connecting', message: 'Alfaterm API is running' });
});

// Ensure DB connection for API routes
app.use(async (req, res, next) => {
  if (dbReady) return next();
  try {
    await connectDB();
    dbReady = true;
    next();
  } catch (error) {
    res.status(503).json({ success: false, message: 'Verilənlər bazasına qoşulmaq mümkün olmadı' });
  }
});

// Mount routes at root for Vercel (routePrefix handles /api)
// Mount routes at /api for local development
if (process.env.VERCEL) {
  app.use('/', routes);
} else {
  app.use('/api', routes);
}

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint tapılmadı'
  });
});

app.use(errorHandler);

// Only listen when not in serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3301;
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
  });
}

module.exports = app;
