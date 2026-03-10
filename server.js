require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const orderRoutes = require('./routes/orderRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

// Webhook route must be registered before express.json() to receive the raw body
app.use('/api/webhook', webhookRoutes);

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    // Allow requests with no origin (e.g. server-to-server, Postman)
    if (!origin) return callback(null, true);

    // Allow any Vercel deployment URL for the frontend project
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/e-commerce-website.*\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }

    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

// Connect to DB on every request (cached internally for serverless)
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api', orderRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'E-Commerce API is running.' });
});

// Only start the HTTP server when running locally (not on Vercel)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
