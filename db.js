const path    = require('path');
const fs      = require('fs');
const bcrypt  = require('bcryptjs');

// APP_ROOT set by main.js env; fallback to __dirname for dev
const APP_ROOT = process.env.APP_ROOT || __dirname;

// FIX: If AYINI_DATA_PATH is provided, use it. Otherwise, fall back gracefully.
const DB_PATH = process.env.AYINI_DATA_PATH
  ? path.join(process.env.AYINI_DATA_PATH, 'ayini.db')
  : path.join(APP_ROOT, 'ayini.db');

let db;

// ── sql.js with WASM path fix for packaged Electron ──────────────────────────
async function getSqlJs() {
  // FIX: Use a clean, static literal string string for require so the bundler resolves it correctly
  const initSqlJs = require('sql.js');
  
  const wasmPath  = process.env.SQLJS_WASM_PATH
    || path.join(APP_ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

  return initSqlJs({
    locateFile: () => wasmPath,
  });
}

// Persist DB to disk
function saveDB() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

// Auto-save every 30 seconds
setInterval(() => { if (db) saveDB(); }, 30000);

async function initDB() {
  // FIX: Explicitly check and recursively build directories for your DB write destination 
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const SQL = await getSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✓ Loaded existing database from', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('✓ Created new database at', DB_PATH);
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      username  TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      role      TEXT DEFAULT 'staff',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      code       INTEGER UNIQUE,
      name       TEXT NOT NULL,
      category   TEXT NOT NULL,
      price      REAL NOT NULL,
      stock      INTEGER DEFAULT 0,
      unit       TEXT DEFAULT 'pack',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bills (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_no      INTEGER NOT NULL,
      customer     TEXT DEFAULT 'Walk-in Customer',
      mobile       TEXT DEFAULT '',
      payment_mode TEXT DEFAULT 'Cash',
      subtotal     REAL DEFAULT 0,
      gst_rate     REAL DEFAULT 0,
      gst_amount   REAL DEFAULT 0,
      cgst_amount  REAL DEFAULT 0,
      sgst_amount  REAL DEFAULT 0,
      discount     REAL DEFAULT 0,
      total        REAL DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id    INTEGER NOT NULL,
      product_id INTEGER,
      name       TEXT NOT NULL,
      price      REAL NOT NULL,
      qty        INTEGER NOT NULL,
      total      REAL NOT NULL,
      FOREIGN KEY(bill_id) REFERENCES bills(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bill_counter (
      id    INTEGER PRIMARY KEY,
      count INTEGER DEFAULT 1
    )
  `);

  // ===== NEW: Create purchases table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_name    TEXT NOT NULL,
      total_amount REAL DEFAULT 0,
      item_count   INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now','localtime')),
      updated_at   TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // ===== NEW: Create purchase_items table (for detailed item tracking) =====
  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      item_name   TEXT NOT NULL,
      qty         REAL DEFAULT 0,
      nos         INTEGER DEFAULT 0,
      amount      REAL NOT NULL,
      FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
    )
  `);

  // ===== NEW: Create settings table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id              INTEGER PRIMARY KEY,
      shop_name       TEXT DEFAULT 'Ayini Home Products',
      gstin_number    TEXT DEFAULT '',
      gst_rate        REAL DEFAULT 0,
      theme_mode      TEXT DEFAULT 'light',
      product_view    TEXT DEFAULT 'grid',
      updated_at      TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // ── MIGRATIONS ─────────────────────────────────────────────────────────────
  const migrations = [
    "ALTER TABLE products ADD COLUMN code INTEGER UNIQUE",
    "ALTER TABLE bills ADD COLUMN cgst_amount REAL DEFAULT 0",
    "ALTER TABLE bills ADD COLUMN sgst_amount REAL DEFAULT 0",
    "ALTER TABLE purchases ADD COLUMN item_count INTEGER DEFAULT 0",
    "ALTER TABLE purchase_items ADD COLUMN qty REAL DEFAULT 0",
    "ALTER TABLE purchase_items ADD COLUMN nos INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN product_view TEXT DEFAULT 'list'",
  ];
  migrations.forEach(sql => {
    try { db.run(sql); } catch(e) { /* column already exists — skip */ }
  });

  // Repair: ensure admin user always has role='admin' (fixes corrupted/null role)
  db.run("UPDATE users SET role='admin' WHERE username='admin' AND (role IS NULL OR role != 'admin')");
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON products(code) WHERE code IS NOT NULL");

  // Seed admin user if not exists
  const adminExists = db.exec("SELECT id FROM users WHERE username='admin'");
  if (!adminExists[0]) {
    const hash = bcrypt.hashSync('ayini123', 10);
    db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hash, 'admin']);
    console.log('✓ Default admin created — username: admin, password: ayini123');
  }

  // Seed bill counter
  const ctr = db.exec("SELECT count FROM bill_counter WHERE id=1");
  if (!ctr[0]) {
    db.run("INSERT INTO bill_counter (id, count) VALUES (1, 1)");
  }

  // ===== NEW: Initialize default settings if none exist =====
  const settingsCheck = db.exec("SELECT id FROM settings WHERE id=1");
  if (!settingsCheck[0]) {
    db.run("INSERT INTO settings (id, shop_name, gstin_number, gst_rate, theme_mode, product_view) VALUES (1, ?, ?, ?, ?, ?)", 
      ['Ayini Home Products', '', 0, 'light', 'list']);
    console.log('✓ Default settings initialized');
  }

  // Seed products if none exist
  const prodCheck = db.exec("SELECT COUNT(*) as c FROM products");
  const prodCount = prodCheck[0].values[0][0];
  if (prodCount === 0) seedProducts();

  saveDB();
  return db;
}

function seedProducts() {
  const products = [
 // MASALA (1-10)
    [1,  "Mutton Masala / Kuruma Masala (250g)", "Masala", 135, 20, "pack"],
    [2,  "Paruppu Podi (100g)", "Masala", 60, 25, "pack"],
    [3,  "Chilli Powder (100g)", "Masala", 50, 30, "pack"],
    [4,  "Malli Powder / Coriander (100g)", "Masala", 40, 30, "pack"],
    [5,  "Idli Podi (250g)", "Masala", 140, 20, "pack"],
    [6,  "Idli Podi (100g)", "Masala", 60, 25, "pack"],
    [7,  "Sambar Podi (250g)", "Masala", 135, 20, "pack"],
    [8,  "Karuveppilai Podi (100g)", "Masala", 60, 20, "pack"],
    [9,  "Chicken Masala (100g)", "Masala", 70, 20, "pack"],
    [10, "Instant Rasam Podi (100g)", "Masala", 80, 20, "pack"],
    
    // FLOUR (11-24)
    [11, "Kavuni Barley Kanji Mix (250g)", "Flour", 125, 15, "pack"],
    [12, "Wheat Kurunai / Kottai Kambu (500g)", "Flour", 35, 20, "pack"],
    [13, "Karuppu Kavuni Kurunai (500g)", "Flour", 140, 15, "pack"],
    [14, "Millet Dosa Mix (500g)", "Flour", 100, 20, "pack"],
    [15, "Multigrain Health Mix (250g)", "Flour", 150, 15, "pack"],
    [16, "Kambu Kurunai (500g)", "Flour", 40, 20, "pack"],
    [17, "Wheat Flour / Gothumai (1kg)", "Flour", 60, 25, "pack"],
    [18, "Ragi (500g)", "Flour", 40, 20, "pack"],
    [19, "Ragi (1kg)", "Flour", 70, 20, "pack"],
    [20, "Multigrain Health Mix (100g)", "Flour", 75, 20, "pack"],
    [21, "Solam Maavu (500g)", "Flour", 40, 20, "pack"],
    
    // OIL (22-28)
    [22, "Coconut Oil (1L)", "Oil", 450, 15, "bottle"],
    [23, "Coconut Oil (500ml)", "Oil", 230, 20, "bottle"],
    [24, "Castor Oil / Vilakku Ennai (250ml)", "Oil", 75, 15, "bottle"],
    [25, "Castor Oil / Vilakku Ennai (500ml)", "Oil", 150, 15, "bottle"],
    [26, "Groundnut Oil (500ml)", "Oil", 140, 20, "bottle"],
    [27, "Groundnut Oil (1L)", "Oil", 275, 15, "bottle"],
    [28, "Gingelly Oil / Nallennai (500ml)", "Oil", 250, 15, "bottle"],
    
    // NOODLES (29-38)
    [29, "Millet Noodles Varagu", "Noodles", 60, 15, "pack"],
    [30, "Semiya Ragi / Tomato / Kambu (225g)", "Noodles", 25, 20, "pack"],
    [31, "Wheat Noodles / Gothumai (Big)", "Noodles", 160, 10, "pack"],
    [32, "Millet Noodles Kuthiravali", "Noodles", 60, 15, "pack"],
    [33, "Millet Noodles Multigrain", "Noodles", 60, 15, "pack"],
    [34, "Millet Noodles Thinai", "Noodles", 60, 15, "pack"],
    [35, "Millet Noodles Sikappuvaragu", "Noodles", 60, 15, "pack"],
    [36, "Millet Noodles Samai", "Noodles", 60, 15, "pack"],
    [37, "Millet Noodles Kambu", "Noodles", 60, 15, "pack"],
    [38, "Millet Noodles Ragi", "Noodles", 60, 15, "pack"],
    
    // PULSES (39-76)
    [39, "Pepper / Milagu (50g)", "Pulses", 47, 30, "pack"],
    [40, "Cardamom / Elakkai (50g)", "Pulses", 200, 15, "pack"],
    [41, "Fenugreek / Vendhayam (250g)", "Pulses", 30, 30, "pack"],
    [42, "Urad Dal / Ulundhu (500g)", "Pulses", 75, 25, "pack"],
    [43, "Cumin Seed / Seeragam (100g)", "Pulses", 45, 25, "pack"],
    [44, "Double Beans (250g)", "Pulses", 40, 20, "pack"],
    [45, "Ragi (1kg)", "Pulses", 70, 30, "pack"],
    [46, "Ragi (500g)", "Pulses", 40, 35, "pack"],
    [47, "Black Gram / Ulundhu (500g)", "Pulses", 65, 25, "pack"],
    [48, "Samai / Little Millet (500g)", "Pulses", 60, 20, "pack"],
    [49, "Ellu / Sesame (500g)", "Pulses", 120, 15, "pack"],
    [50, "Pearl Millet / Naattu Kambu (500g)", "Pulses", 50, 20, "pack"],
    [51, "Barnyard Millet / Kuthiravali (500g)", "Pulses", 60, 20, "pack"],
    [52, "Horse Gram / Kollu (500g)", "Pulses", 55, 20, "pack"],
    [53, "Sundal (1kg)", "Pulses", 110, 20, "pack"],
    [54, "Sundal (500g)", "Pulses", 55, 25, "pack"],
    [55, "Greengram / Paasi Payiru (500g)", "Pulses", 70, 20, "pack"],
    [56, "Soya Chunks Big (250g)", "Pulses", 30, 20, "pack"],
    [57, "Soya Chunks Small (250g)", "Pulses", 30, 20, "pack"],
    [58, "Solam / Sorghum (500g)", "Pulses", 30, 20, "pack"],
    [59, "Red Aval (250g)", "Pulses", 30, 20, "pack"],
    [60, "White Aval (250g)", "Pulses", 30, 20, "pack"],
    [61, "Seeraga Samba Rice (1kg)", "Pulses", 180, 20, "pack"],
    [62, "Roasted Groundnut (250g)", "Pulses", 55, 20, "pack"],
    [63, "Varukadalai (250g)", "Pulses", 35, 20, "pack"],
    [64, "Varukadalai (500g)", "Pulses", 70, 20, "pack"],
    [65, "Naatu Sakarai (500g)", "Pulses", 40, 20, "pack"],
    [66, "Naatu Sakarai (1kg)", "Pulses", 70, 20, "pack"],
    [67, "Black Ulundhu (1kg)", "Pulses", 140, 20, "pack"],
    [68, "Karuppu K. Rice (1kg)", "Pulses", 220, 20, "pack"],
    [69, "Rajma (250g)", "Pulses", 35, 20, "pack"],
    
    // OTHER ITEMS (70-93)
    [70, "Curd", "Other Items", 10, 20, "pack"],
    [71, "Milk", "Other Items", 10, 20, "pack"],
    [72, "Kiwi", "Other Items", 65, 20, "pack"],
    [73, "Honey Amla", "Other Items", 65, 20, "pack"],
    [74, "Mixed Nuts", "Other Items", 150, 20, "pack"],
    [75, "Mixed Seeds", "Other Items", 100, 20, "pack"],
    [76, "Sabja Seeds", "Other Items", 25, 20, "pack"],
    [77, "Chia Seeds", "Other Items", 25, 20, "pack"],
    [78, "Cashew Nuts", "Other Items", 60, 20, "pack"],
    [79, "Grapes", "Other Items", 35, 20, "pack"],
    [80, "Pista", "Other Items", 85, 20, "pack"],
    [81, "Badam", "Other Items", 60, 20, "pack"],
    [82, "Dates", "Other Items", 50, 20, "pack"],
    [83, "Idly Maavu", "Other Items", 30, 20, "pack"],
    [84, "Premium Tea Powder (100g)", "Other Items", 40, 20, "pack"],
    [85, "Herbal Hair Oil (200g)", "Other Items", 175, 15, "bottle"],
    [86, "Nalangu Maavu Soap", "Other Items", 70, 20, "bar"],
    [87, "Muthanimetti Soap", "Other Items", 70, 20, "bar"],
    [88, "Vettiver Soap", "Other Items", 70, 20, "bar"],
    [89, "Kuppaimeni Soap", "Other Items", 70, 20, "bar"],
    [90, "Sandal Leaf Soap", "Other Items", 70, 20, "bar"],
    [91, "Bathing Soap", "Other Items", 70, 20, "bar"],
    [92, "Sandal Soap", "Other Items", 70, 20, "bar"],
    [93, "Arisi Maavu Soap", "Other Items", 70, 20, "bar"]
  ];

  const stmt = db.prepare("INSERT INTO products (code, name, category, price, stock, unit) VALUES (?, ?, ?, ?, ?, ?)");
  products.forEach(p => stmt.run(p));
  stmt.free();
  console.log(`✓ Seeded ${products.length} products`);
}

// ===== DB HELPER FUNCTIONS =====

function query(sql, params = []) {
  try {
    if (params.length === 0) {
      const result = db.exec(sql);
      if (!result[0]) return [];
      const { columns, values } = result[0];
      return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      });
    }
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (e) {
    console.error('DB query error:', e.message, sql);
    return [];
  }
}

function run(sql, params = []) {
  try {
    db.run(sql, params);
    saveDB();
    return { lastInsertRowid: db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0] };
  } catch (e) {
    console.error('DB run error:', e.message);
    throw e;
  }
}

function get(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

module.exports = { initDB, query, run, get, saveDB };