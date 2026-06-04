// ===== ADD THESE LINES TO server.js AFTER EXISTING ROUTE IMPORTS =====

// AFTER: const reportRoutes  = require(path.join(APP_ROOT, 'routes', 'reports'));

const purchaseRoutes = require(path.join(APP_ROOT, 'routes', 'purchases'));
const settingsRoutes = require(path.join(APP_ROOT, 'routes', 'settings'));

// ===== THEN ADD THESE LINES IN THE API ROUTES SECTION =====

// AFTER: app.use('/api/reports',  reportRoutes);

app.use('/api/purchases', purchaseRoutes);
app.use('/api/settings',  settingsRoutes);

// ===== COMPLETE server.js SHOULD LOOK LIKE THIS: =====

/*
const express  = require('express');
const cors     = require('cors');
const path     = require('path');

// APP_ROOT is set by main.js when packaged; falls back to __dirname in dev
const APP_ROOT = process.env.APP_ROOT || __dirname;

require('dotenv').config({ path: path.join(APP_ROOT, '.env') });

const { initDB }    = require(path.join(APP_ROOT, 'db'));
const authRoutes    = require(path.join(APP_ROOT, 'routes', 'auth'));
const productRoutes = require(path.join(APP_ROOT, 'routes', 'products'));
const billRoutes    = require(path.join(APP_ROOT, 'routes', 'bills'));
const reportRoutes  = require(path.join(APP_ROOT, 'routes', 'reports'));
const purchaseRoutes = require(path.join(APP_ROOT, 'routes', 'purchases'));
const settingsRoutes = require(path.join(APP_ROOT, 'routes', 'settings'));

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});
// Serve frontend static files
app.use(express.static(path.join(APP_ROOT, 'public')));

// API Routes
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/bills',    billRoutes);
app.use('/api/reports',  reportRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/settings',  settingsRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Fallback to frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(APP_ROOT, 'public', 'index.html'));
});

// Init DB then start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌿 Ayini Billing Server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
*/
