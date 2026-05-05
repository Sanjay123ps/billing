const initSqlJs = require('sql.js');
const fs        = require('fs');
const path      = require('path');
const bcrypt    = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'ayini.db');

let db;

// Persist DB to disk
function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Auto-save every 30 seconds
setInterval(() => { if (db) saveDB(); }, 30000);

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✓ Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('✓ Created new database');
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

  // ── MIGRATIONS — safe to run on every startup ──────────────────────────────
  // ALTER TABLE is ignored if column already exists (caught silently)
  const migrations = [
    "ALTER TABLE products ADD COLUMN code INTEGER UNIQUE",
    "ALTER TABLE bills ADD COLUMN cgst_amount REAL DEFAULT 0",
    "ALTER TABLE bills ADD COLUMN sgst_amount REAL DEFAULT 0",
  ];
  migrations.forEach(sql => {
    try { db.run(sql); } catch(e) { /* column already exists — skip */ }
  });
  // Unique index on product codes (safe to re-run with IF NOT EXISTS)
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON products(code) WHERE code IS NOT NULL");
  // ───────────────────────────────────────────────────────────────────────────

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

  // Seed products if none exist
  const prodCheck = db.exec("SELECT COUNT(*) as c FROM products");
  const prodCount = prodCheck[0].values[0][0];
  if (prodCount === 0) {
    seedProducts();
  }

  saveDB();
  return db;
}

function seedProducts() {
  const products = [
    // [code, name, category, price, stock, unit]
    [1,  "Mutton Masala / Kuruma Masala (250g)", "Masala Items",             135, 20, "pack"],
    [2,  "Paruppu Podi (100g)",                  "Masala Items",             60,  25, "pack"],
    [3,  "Chilli Powder (100g)",                 "Masala Items",             50,  30, "pack"],
    [4,  "Malli Powder / Coriander (100g)",      "Masala Items",             40,  30, "pack"],
    [5,  "Idli Podi (250g)",                     "Masala Items",             140, 20, "pack"],
    [6,  "Idli Podi (100g)",                     "Masala Items",             60,  25, "pack"],
    [7,  "Sambar Podi (250g)",                   "Masala Items",             135, 20, "pack"],
    [8,  "Karuveppilai Podi (100g)",             "Masala Items",             60,  20, "pack"],
    [9,  "Chicken Masala (100g)",                "Masala Items",             70,  20, "pack"],
    [10, "Instant Rasam Podi (100g)",            "Masala Items",             80,  20, "pack"],
    [11, "Pepper / Milagu (50g)",                "Pulses, Millets & Spices", 47,  30, "pack"],
    [12, "Cardamom / Elakkai (50g)",             "Pulses, Millets & Spices", 200, 15, "pack"],
    [13, "Fenugreek / Vendhayam (250g)",         "Pulses, Millets & Spices", 30,  30, "pack"],
    [14, "Urad Dal / Ulundhu (500g)",            "Pulses, Millets & Spices", 75,  25, "pack"],
    [15, "Cumin Seed / Seeragam (100g)",         "Pulses, Millets & Spices", 45,  25, "pack"],
    [16, "Double Beans (250g)",                  "Pulses, Millets & Spices", 40,  20, "pack"],
    [17, "Ragi (1kg)",                           "Pulses, Millets & Spices", 70,  30, "pack"],
    [18, "Ragi (500g)",                          "Pulses, Millets & Spices", 40,  35, "pack"],
    [19, "Black Gram / Ulundhu (500g)",          "Pulses, Millets & Spices", 65,  25, "pack"],
    [20, "Samai / Little Millet (500g)",         "Pulses, Millets & Spices", 60,  20, "pack"],
    [21, "Ellu / Sesame (500g)",                 "Pulses, Millets & Spices", 120, 15, "pack"],
    [22, "Pearl Millet / Naattu Kambu (500g)",   "Pulses, Millets & Spices", 50,  20, "pack"],
    [23, "Barnyard Millet / Kuthiravali (500g)", "Pulses, Millets & Spices", 60,  20, "pack"],
    [24, "Horse Gram / Kollu (500g)",            "Pulses, Millets & Spices", 55,  20, "pack"],
    [25, "Sundal (1kg)",                         "Pulses, Millets & Spices", 110, 20, "pack"],
    [26, "Sundal (500g)",                        "Pulses, Millets & Spices", 55,  25, "pack"],
    [27, "Greengram / Paasi Payiru (500g)",      "Pulses, Millets & Spices", 70,  20, "pack"],
    [28, "Soya Chunks Big (250g)",               "Pulses, Millets & Spices", 30,  20, "pack"],
    [29, "Soya Chunks Small (250g)",             "Pulses, Millets & Spices", 30,  20, "pack"],
    [30, "Solam / Sorghum (500g)",               "Pulses, Millets & Spices", 30,  20, "pack"],
    [31, "Coconut Oil (1L)",                     "Oil Items",                450, 15, "bottle"],
    [32, "Coconut Oil (500ml)",                  "Oil Items",                230, 20, "bottle"],
    [33, "Castor Oil / Vilakku Ennai (250ml)",   "Oil Items",                75,  15, "bottle"],
    [34, "Castor Oil / Vilakku Ennai (500ml)",   "Oil Items",                150, 15, "bottle"],
    [35, "Groundnut Oil (500ml)",                "Oil Items",                140, 20, "bottle"],
    [36, "Groundnut Oil (1L)",                   "Oil Items",                275, 15, "bottle"],
    [37, "Gingelly Oil / Nallennai (500ml)",     "Oil Items",                250, 15, "bottle"],
    [38, "Kavuni Barley Kanji Mix (250g)",       "Flour Items",              125, 15, "pack"],
    [39, "Wheat Kurunai / Kottai Kambu (500g)",  "Flour Items",              35,  20, "pack"],
    [40, "Karuppu Kavuni Kurunai (500g)",        "Flour Items",              140, 15, "pack"],
    [41, "Millet Dosa Mix (500g)",               "Flour Items",              100, 20, "pack"],
    [42, "Multigrain Health Mix (250g)",         "Flour Items",              150, 15, "pack"],
    [43, "Kambu Kurunai (500g)",                 "Flour Items",              40,  20, "pack"],
    [44, "Wheat Flour / Gothumai (1kg)",         "Flour Items",              60,  25, "pack"],
    [45, "Millet Noodles Varagu",                "Noodles & Semiya",         60,  15, "pack"],
    [46, "Semiya Ragi / Tomato / Kambu (225g)",  "Noodles & Semiya",         25,  20, "pack"],
    [47, "Wheat Noodles / Gothumai (Big)",       "Noodles & Semiya",         160, 10, "pack"],
    [48, "Millet Noodles Kuthiravali",           "Noodles & Semiya",         60,  15, "pack"],
    [49, "Millet Noodles Multigrain",            "Noodles & Semiya",         60,  15, "pack"],
    [50, "Millet Noodles Thinai",                "Noodles & Semiya",         60,  15, "pack"],
    [51, "Millet Noodles Sikappuvaragu",         "Noodles & Semiya",         60,  15, "pack"],
    [52, "Millet Noodles Samai",                 "Noodles & Semiya",         60,  15, "pack"],
    [53, "Millet Noodles Kambu",                 "Noodles & Semiya",         60,  15, "pack"],
    [54, "Millet Noodles Ragi",                  "Noodles & Semiya",         60,  15, "pack"],
    [55, "Herbal Hair Oil (200g)",               "Skin Care & Hair Care",    175, 15, "bottle"],
    [56, "Nalangu Maavu Soap",                   "Skin Care & Hair Care",    70,  20, "bar"],
    [57, "Muthanimetti Soap",                    "Skin Care & Hair Care",    70,  20, "bar"],
    [58, "Vettiver Soap",                        "Skin Care & Hair Care",    70,  20, "bar"],
    [59, "Kuppaimeni Soap",                      "Skin Care & Hair Care",    70,  20, "bar"],
    [60, "Sandal Leaf Soap",                     "Skin Care & Hair Care",    70,  20, "bar"],
    [61, "Bathing Soap",                         "Skin Care & Hair Care",    70,  20, "bar"],
    [62, "Sandal Soap",                          "Skin Care & Hair Care",    70,  20, "bar"],
    [63, "Arisi Maavu Soap",                     "Skin Care & Hair Care",    70,  20, "bar"],
  ];

  const stmt = db.prepare("INSERT INTO products (code, name, category, price, stock, unit) VALUES (?, ?, ?, ?, ?, ?)");
  products.forEach(p => stmt.run(p));
  stmt.free();
  console.log(`✓ Seeded ${products.length} products with codes 1–${products.length}`);
}

// ===== DB HELPER FUNCTIONS =====

function query(sql, params = []) {
  try {
    const result = db.exec(sql, params);
    if (!result[0]) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
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
