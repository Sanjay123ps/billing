const router = require('express').Router();
const { query, run, get } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/products  — get all products
router.get('/', authMiddleware, (req, res) => {
  const { cat, search } = req.query;
  let sql = "SELECT * FROM products WHERE 1=1";
  const params = [];
  if (cat)    { sql += " AND category = ?";        params.push(cat); }
  if (search) { sql += " AND name LIKE ?";          params.push(`%${search}%`); }
  sql += " ORDER BY category, name";
  res.json(query(sql, params));
});

// GET /api/products/categories
router.get('/categories', authMiddleware, (req, res) => {
  const cats = query("SELECT DISTINCT category FROM products ORDER BY category");
  res.json(cats.map(c => c.category));
});

// GET /api/products/:id
router.get('/:id', authMiddleware, (req, res) => {
  const p = get("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

// POST /api/products  — add product (admin only)
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { name, category, price, stock, unit, code } = req.body;
  if (!name || !category || price == null) return res.status(400).json({ error: 'name, category and price are required' });
  const result = run(
    "INSERT INTO products (code, name, category, price, stock, unit) VALUES (?, ?, ?, ?, ?, ?)",
    [code ? parseInt(code) : null, name, category, parseFloat(price), parseInt(stock)||0, unit||'pack']
  );
  const newProd = get("SELECT * FROM products WHERE id = ?", [result.lastInsertRowid]);
  res.status(201).json(newProd);
});

// PUT /api/products/:id  — update product (admin only)
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, category, price, stock, unit, code } = req.body;
  const p = get("SELECT id FROM products WHERE id = ?", [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  run(
    "UPDATE products SET code=?, name=?, category=?, price=?, stock=?, unit=?, updated_at=datetime('now') WHERE id=?",
    [code ? parseInt(code) : null, name, category, parseFloat(price), parseInt(stock), unit, req.params.id]
  );
  res.json(get("SELECT * FROM products WHERE id = ?", [req.params.id]));
});

// PATCH /api/products/:id/stock  — adjust stock only
router.patch('/:id/stock', authMiddleware, (req, res) => {
  const { stock, delta } = req.body;
  const p = get("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Product not found' });

  let newStock;
  if (delta !== undefined) {
    newStock = Math.max(0, p.stock + parseInt(delta));
  } else {
    newStock = Math.max(0, parseInt(stock));
  }
  run("UPDATE products SET stock=?, updated_at=datetime('now') WHERE id=?", [newStock, req.params.id]);
  res.json({ ...p, stock: newStock });
});

// DELETE /api/products/:id  — delete product (admin only)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const p = get("SELECT id FROM products WHERE id = ?", [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  run("DELETE FROM products WHERE id = ?", [req.params.id]);
  res.json({ message: 'Product deleted' });
});

module.exports = router;
