// server.js
'use strict';

const express    = require('express');
const mongoose   = require('mongoose');
const path       = require('path');
require('dotenv').config();

const productsRouter = require('./api/routes/products');
const historyRouter  = require('./api/routes/history');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────
app.use('/api/products', productsRouter);
app.use('/api',          historyRouter);   // covers /submit, /history

// ── Catch-all: serve index.html ───────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── MongoDB + Start ───────────────────────────
async function startServer() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌  MONGODB_URI is not set in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅  MongoDB connected');

    app.listen(PORT, () => {
      console.log(`🚀  Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

startServer();
