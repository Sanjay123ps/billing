const router = require('express').Router();
const { query, run, get } = require('../db');
const { authenticateToken, adminOnly } = require('../middleware/auth');

// GET /api/products  — get all products
router.get('/', authenticateToken, (req, res) => {
  const { cat, search } = req.query;
  let sql = "SELECT * FROM products WHERE 1=1";
  const params = [];
  if (cat)    { sql += " AND category = ?";        params.push(cat); }
  if (search) { sql += " AND name LIKE ?";          params.push(`%${search}%`); }
  sql += " ORDER BY category, name";
  res.json(query(sql, params));
});

// GET /api/products/categories
router.get('/categories', authenticateToken, (req, res) => {
  const cats = query("SELECT DISTINCT category FROM products ORDER BY category");
  res.json(cats.map(c => c.category));
});

// GET /api/products/:id
router.get('/:id', authenticateToken, (req, res) => {
  const p = get("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

// POST /api/products  — add product (admin only)
router.post('/', authenticateToken, adminOnly, (req, res) => {
  let { name, category, price, stock, unit, code } = req.body;

  name = String(name || '').trim();
  category = String(category || '').trim();
  unit = String(unit || 'pack').trim();

  price = parseFloat(price);
  stock = parseInt(stock, 10);

  if (!name) {
    return res.status(400).json({ error: 'Product name required' });
  }

  if (!category) {
    return res.status(400).json({ error: 'Category required' });
  }

  if (isNaN(price) || price < 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }

  if (isNaN(stock) || stock < 0) {
    stock = 0;
  }

  if (code !== null && code !== undefined && code !== '') {
    const exists = get(
      "SELECT id FROM products WHERE code = ?",
      [parseInt(code, 10)]
    );

    if (exists) {
      return res.status(400).json({ error: 'Product code already exists' });
    }

    code = parseInt(code, 10);
  } else {
    code = null;
  }

  const result = run(
    `INSERT INTO products 
    (code, name, category, price, stock, unit) 
    VALUES (?, ?, ?, ?, ?, ?)`,
    [code, name, category, price, stock, unit]
  );

  const newProd = get(
    "SELECT * FROM products WHERE id = ?",
    [result.lastInsertRowid]
  );

  res.status(201).json(newProd);
});

// PUT /api/products/:id  — update product (admin only)
router.put('/:id', authenticateToken, adminOnly, (req, res) => {
  let { name, category, price, stock, unit, code } = req.body;

  const existing = get(
    "SELECT * FROM products WHERE id = ?",
    [req.params.id]
  );

  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  name = String(name || '').trim();
  category = String(category || '').trim();
  unit = String(unit || existing.unit || 'pack').trim();

  price = parseFloat(price);
  stock = parseInt(stock, 10);

  if (!name) {
    return res.status(400).json({ error: 'Product name required' });
  }

  if (!category) {
    return res.status(400).json({ error: 'Category required' });
  }

  if (isNaN(price) || price < 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }

  if (isNaN(stock) || stock < 0) {
    stock = 0;
  }

  if (code !== null && code !== undefined && code !== '') {
    code = parseInt(code, 10);

    const duplicate = get(
      "SELECT id FROM products WHERE code = ? AND id != ?",
      [code, req.params.id]
    );

    if (duplicate) {
      return res.status(400).json({ error: 'Product code already exists' });
    }
  } else {
    code = null;
  }

  run(
    `UPDATE products 
     SET code=?,
         name=?,
         category=?,
         price=?,
         stock=?,
         unit=?,
         updated_at=datetime('now')
     WHERE id=?`,
    [
      code,
      name,
      category,
      price,
      stock,
      unit,
      req.params.id
    ]
  );

  res.json(
    get("SELECT * FROM products WHERE id = ?", [req.params.id])
  );
});

// PATCH /api/products/:id/stock  — adjust stock only
router.patch('/:id/stock', authenticateToken, (req, res) => {
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
router.delete('/:id', authenticateToken, adminOnly, (req, res) => {
  const p = get("SELECT id FROM products WHERE id = ?", [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  run("DELETE FROM products WHERE id = ?", [req.params.id]);
  res.json({ message: 'Product deleted' });
});

module.exports = router;
