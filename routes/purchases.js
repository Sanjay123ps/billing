const express = require('express');
const router = express.Router();
const path = require('path');
const { query, run, get } = require(path.join(process.env.APP_ROOT || __dirname, '..', 'db'));
const { authenticateToken } = require(path.join(process.env.APP_ROOT || __dirname, '..', 'middleware', 'auth'));

// Middleware: Check authentication
router.use(authenticateToken);

// POST /api/purchases - Create new purchase
router.post('/', (req, res) => {
  try {
    const { shopName, items } = req.body;
    
    if (!shopName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Shop name and items required' });
    }

    // Calculate total
    const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const itemCount = items.length;

    // Insert purchase
    const result = run(
      "INSERT INTO purchases (shop_name, total_amount, item_count) VALUES (?, ?, ?)",
      [shopName, totalAmount, itemCount]
    );

    const purchaseId = result.lastInsertRowid;

    // Insert items
    const stmt = "INSERT INTO purchase_items (purchase_id, item_name, amount) VALUES (?, ?, ?)";
    items.forEach(item => {
      run(stmt, [purchaseId, item.name, parseFloat(item.amount || 0)]);
    });

    return res.json({ 
      success: true, 
      purchase_id: purchaseId,
      shop_name: shopName,
      total_amount: totalAmount,
      item_count: itemCount
    });
  } catch (err) {
    console.error('Error creating purchase:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/purchases - List all purchases with optional filters
router.get('/', (req, res) => {
  try {
    const { filter } = req.query;
    let whereClause = '';
    let params = [];

    if (filter) {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      switch (filter) {
        case 'today':
          whereClause = "WHERE DATE(created_at) = DATE('now','localtime')";
          break;
        case 'month':
          whereClause = "WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime')";
          break;
        case 'six-months':
          whereClause = "WHERE created_at >= datetime('now','-6 months','localtime')";
          break;
        case 'year':
          whereClause = "WHERE strftime('%Y', created_at) = strftime('%Y', 'now','localtime')";
          break;
      }
    }

    const purchases = query(`SELECT * FROM purchases ${whereClause} ORDER BY created_at DESC`, params);
    
    // Fetch items for each purchase
    const purchasesWithItems = purchases.map(p => {
      const items = query("SELECT item_name, amount FROM purchase_items WHERE purchase_id = ?", [p.id]);
      return {
        ...p,
        items: items
      };
    });

    return res.json({ success: true, purchases: purchasesWithItems });
  } catch (err) {
    console.error('Error fetching purchases:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/purchases/:id - Get single purchase with items
router.get('/:id', (req, res) => {
  try {
    const purchase = get("SELECT * FROM purchases WHERE id = ?", [req.params.id]);
    
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const items = query("SELECT item_name, amount FROM purchase_items WHERE purchase_id = ?", [purchase.id]);
    
    return res.json({ 
      success: true, 
      purchase: { ...purchase, items } 
    });
  } catch (err) {
    console.error('Error fetching purchase:', err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/purchases/:id - Delete purchase
router.delete('/:id', (req, res) => {
  try {
    const purchase = get("SELECT * FROM purchases WHERE id = ?", [req.params.id]);
    
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    // Delete items first (FK constraint)
    run("DELETE FROM purchase_items WHERE purchase_id = ?", [req.params.id]);
    
    // Delete purchase
    run("DELETE FROM purchases WHERE id = ?", [req.params.id]);

    return res.json({ success: true, message: 'Purchase deleted' });
  } catch (err) {
    console.error('Error deleting purchase:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
