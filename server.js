const express    = require('express');
const cors       = require('cors');
const path       = require('path');
require('dotenv').config();

const { initDB }      = require('./db');
const authRoutes      = require('./routes/auth');
const productRoutes   = require('./routes/products');
const billRoutes      = require('./routes/bills');
const reportRoutes    = require('./routes/reports');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/bills',    billRoutes);
app.use('/api/reports',  reportRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Fallback to frontend for all other routes
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Init DB then start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌿 Ayini Billing Server running at http://localhost:${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api`);
    console.log(`   Press Ctrl+C to stop\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
