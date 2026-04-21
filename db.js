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
    ["Mutton Masala / Kuruma Masala (250g)", "Masala Items",             135, 20, "pack"],
    ["Paruppu Podi (100g)",                  "Masala Items",             60,  25, "pack"],
    ["Chilli Powder (100g)",                 "Masala Items",             50,  30, "pack"],
    ["Malli Powder / Coriander (100g)",      "Masala Items",             40,  30, "pack"],
    ["Idli Podi (250g)",                     "Masala Items",             140, 20, "pack"],
    ["Idli Podi (100g)",                     "Masala Items",             60,  25, "pack"],
    ["Sambar Podi (250g)",                   "Masala Items",             135, 20, "pack"],
    ["Karuveppilai Podi (100g)",             "Masala Items",             60,  20, "pack"],
    ["Chicken Masala (100g)",                "Masala Items",             70,  20, "pack"],
    ["Instant Rasam Podi (100g)",            "Masala Items",             80,  20, "pack"],
    ["Pepper / Milagu (50g)",                "Pulses, Millets & Spices", 47,  30, "pack"],
    ["Cardamom / Elakkai (50g)",             "Pulses, Millets & Spices", 200, 15, "pack"],
    ["Fenugreek / Vendhayam (250g)",         "Pulses, Millets & Spices", 30,  30, "pack"],
    ["Urad Dal / Ulundhu (500g)",            "Pulses, Millets & Spices", 75,  25, "pack"],
    ["Cumin Seed / Seeragam (100g)",         "Pulses, Millets & Spices", 45,  25, "pack"],
    ["Double Beans (250g)",                  "Pulses, Millets & Spices", 40,  20, "pack"],
    ["Ragi (1kg)",                           "Pulses, Millets & Spices", 70,  30, "pack"],
    ["Ragi (500g)",                          "Pulses, Millets & Spices", 40,  35, "pack"],
    ["Black Gram / Ulundhu (500g)",          "Pulses, Millets & Spices", 65,  25, "pack"],
    ["Samai / Little Millet (500g)",         "Pulses, Millets & Spices", 60,  20, "pack"],
    ["Ellu / Sesame (500g)",                 "Pulses, Millets & Spices", 120, 15, "pack"],
    ["Pearl Millet / Naattu Kambu (500g)",   "Pulses, Millets & Spices", 50,  20, "pack"],
    ["Barnyard Millet / Kuthiravali (500g)", "Pulses, Millets & Spices", 60,  20, "pack"],
    ["Horse Gram / Kollu (500g)",            "Pulses, Millets & Spices", 55,  20, "pack"],
    ["Sundal (1kg)",                         "Pulses, Millets & Spices", 110, 20, "pack"],
    ["Sundal (500g)",                        "Pulses, Millets & Spices", 55,  25, "pack"],
    ["Greengram / Paasi Payiru (500g)",      "Pulses, Millets & Spices", 70,  20, "pack"],
    ["Soya Chunks Big (250g)",               "Pulses, Millets & Spices", 30,  20, "pack"],
    ["Soya Chunks Small (250g)",             "Pulses, Millets & Spices", 30,  20, "pack"],
    ["Solam / Sorghum (500g)",               "Pulses, Millets & Spices", 30,  20, "pack"],
    ["Coconut Oil (1L)",                     "Oil Items",                450, 15, "bottle"],
    ["Coconut Oil (500ml)",                  "Oil Items",                230, 20, "bottle"],
    ["Castor Oil / Vilakku Ennai (250ml)",   "Oil Items",                75,  15, "bottle"],
    ["Castor Oil / Vilakku Ennai (500ml)",   "Oil Items",                150, 15, "bottle"],
    ["Groundnut Oil (500ml)",                "Oil Items",                140, 20, "bottle"],
    ["Groundnut Oil (1L)",                   "Oil Items",                275, 15, "bottle"],
    ["Gingelly Oil / Nallennai (500ml)",     "Oil Items",                250, 15, "bottle"],
    ["Kavuni Barley Kanji Mix (250g)",       "Flour Items",              125, 15, "pack"],
    ["Wheat Kurunai / Kottai Kambu (500g)",  "Flour Items",              35,  20, "pack"],
    ["Karuppu Kavuni Kurunai (500g)",        "Flour Items",              140, 15, "pack"],
    ["Millet Dosa Mix (500g)",               "Flour Items",              100, 20, "pack"],
    ["Multigrain Health Mix (250g)",         "Flour Items",              150, 15, "pack"],
    ["Kambu Kurunai (500g)",                 "Flour Items",              40,  20, "pack"],
    ["Wheat Flour / Gothumai (1kg)",         "Flour Items",              60,  25, "pack"],
    ["Millet Noodles Varagu",                "Noodles & Semiya",         60,  15, "pack"],
    ["Semiya Ragi / Tomato / Kambu (225g)",  "Noodles & Semiya",         25,  20, "pack"],
    ["Wheat Noodles / Gothumai (Big)",       "Noodles & Semiya",         160, 10, "pack"],
    ["Millet Noodles Kuthiravali",           "Noodles & Semiya",         60,  15, "pack"],
    ["Millet Noodles Multigrain",            "Noodles & Semiya",         60,  15, "pack"],
    ["Millet Noodles Thinai",                "Noodles & Semiya",         60,  15, "pack"],
    ["Millet Noodles Sikappuvaragu",         "Noodles & Semiya",         60,  15, "pack"],
    ["Millet Noodles Samai",                 "Noodles & Semiya",         60,  15, "pack"],
    ["Millet Noodles Kambu",                 "Noodles & Semiya",         60,  15, "pack"],
    ["Millet Noodles Ragi",                  "Noodles & Semiya",         60,  15, "pack"],
    ["Herbal Hair Oil (200g)",               "Skin Care & Hair Care",    175, 15, "bottle"],
    ["Nalangu Maavu Soap",                   "Skin Care & Hair Care",    70,  20, "bar"],
    ["Muthanimetti Soap",                    "Skin Care & Hair Care",    70,  20, "bar"],
    ["Vettiver Soap",                        "Skin Care & Hair Care",    70,  20, "bar"],
    ["Kuppaimeni Soap",                      "Skin Care & Hair Care",    70,  20, "bar"],
    ["Sandal Leaf Soap",                     "Skin Care & Hair Care",    70,  20, "bar"],
    ["Bathing Soap",                         "Skin Care & Hair Care",    70,  20, "bar"],
    ["Sandal Soap",                          "Skin Care & Hair Care",    70,  20, "bar"],
    ["Arisi Maavu Soap",                     "Skin Care & Hair Care",    70,  20, "bar"],
  ];

  const stmt = db.prepare("INSERT INTO products (name, category, price, stock, unit) VALUES (?, ?, ?, ?, ?)");
  products.forEach(p => stmt.run(p));
  stmt.free();
  console.log(`✓ Seeded ${products.length} products`);
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
