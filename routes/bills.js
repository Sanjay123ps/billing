const router = require('express').Router();
const { query, run, get } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/bills  — list all bills (newest first)
router.get('/', authMiddleware, (req, res) => {
  const { search, payment, from, to, limit = 100, offset = 0 } = req.query;
  let sql = "SELECT * FROM bills WHERE 1=1";
  const params = [];
  if (search)  { sql += " AND (customer LIKE ? OR bill_no = ?)"; params.push(`%${search}%`, parseInt(search)||0); }
  if (payment) { sql += " AND payment_mode = ?"; params.push(payment); }
  if (from)    { sql += " AND date(created_at) >= ?"; params.push(from); }
  if (to)      { sql += " AND date(created_at) <= ?"; params.push(to); }
  sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));
  const bills = query(sql, params);
  res.json(bills);
});

// GET /api/bills/:id  — get bill with items
router.get('/:id', authMiddleware, (req, res) => {
  const bill = get("SELECT * FROM bills WHERE id = ?", [req.params.id]);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  const items = query("SELECT bi.*, bi.name as name, bi.price as price, bi.qty as qty, bi.total as total FROM bill_items bi WHERE bi.bill_id = ? ORDER BY bi.id ASC", [req.params.id]);
  res.json({ ...bill, items: items || [] });
});

// POST /api/bills  — create new bill
router.post('/', authMiddleware, (req, res) => {
  const { customer, mobile, payment_mode, gst_rate, subtotal, gst_amount, discount, total, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Bill must have at least one item' });

  // Get and increment bill counter
  const ctr = get("SELECT count FROM bill_counter WHERE id=1");
  const bill_no = ctr ? ctr.count : 1;
  run("UPDATE bill_counter SET count = count + 1 WHERE id = 1");

  // Insert bill
  const result = run(
    `INSERT INTO bills (bill_no, customer, mobile, payment_mode, subtotal, gst_rate, gst_amount, discount, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [bill_no, customer||'Walk-in Customer', mobile||'', payment_mode||'Cash',
     parseFloat(subtotal)||0, parseFloat(gst_rate)||0,
     parseFloat(gst_amount)||0, parseFloat(discount)||0, parseFloat(total)||0]
  );
  const bill_id = result.lastInsertRowid;

  // Insert items & deduct stock
  const itemStmt = "INSERT INTO bill_items (bill_id, product_id, name, price, qty, total) VALUES (?, ?, ?, ?, ?, ?)";
  items.forEach(item => {
    run(itemStmt, [bill_id, item.product_id||item.id||null, item.name, parseFloat(item.price), parseInt(item.qty), parseFloat(item.total)]);
    // Deduct stock
    if (item.product_id || item.id) {
      const pid = item.product_id || item.id;
      run("UPDATE products SET stock = MAX(0, stock - ?), updated_at=datetime('now') WHERE id = ?", [parseInt(item.qty), pid]);
    }
  });

  const newBill = get("SELECT * FROM bills WHERE id = ?", [bill_id]);
  const newItems = query("SELECT * FROM bill_items WHERE bill_id = ?", [bill_id]);
  res.status(201).json({ ...newBill, items: newItems });
});

// DELETE /api/bills/:id (admin only, soft concept — just removes)
router.delete('/:id', authMiddleware, (req, res) => {
  const bill = get("SELECT id FROM bills WHERE id = ?", [req.params.id]);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  run("DELETE FROM bill_items WHERE bill_id = ?", [req.params.id]);
  run("DELETE FROM bills WHERE id = ?", [req.params.id]);
  res.json({ message: 'Bill deleted' });
});

module.exports = router;
