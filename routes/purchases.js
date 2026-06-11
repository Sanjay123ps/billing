const express = require('express');
const router = express.Router();
const { query, run, get } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Middleware: Check authentication
router.use(authenticateToken);

// POST /api/purchases - Create new purchase
router.post('/', (req, res) => {
  try {
    const { shopName, items } = req.body;
    
    if (!shopName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Shop name and items required' });
    }

    // Validate items have a name
    const validItems = items.filter(item => item.name && item.name.trim() !== '');
    if (validItems.length === 0) {
      return res.status(400).json({ error: 'At least one item with a name is required' });
    }

    // Calculate total
    const totalAmount = validItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const itemCount = validItems.length;

    // Insert purchase
    const result = run(
      "INSERT INTO purchases (shop_name, total_amount, item_count) VALUES (?, ?, ?)",
      [shopName, totalAmount, itemCount]
    );

    const purchaseId = result.lastInsertRowid;

    // Insert items with qty and nos
    const stmt = "INSERT INTO purchase_items (purchase_id, item_name, qty, nos, amount) VALUES (?, ?, ?, ?, ?)";
    validItems.forEach(item => {
      run(stmt, [
        purchaseId,
        item.name.trim(),
        parseFloat(item.qty || 0),
        parseInt(item.nos || 0),
        parseFloat(item.amount || 0)
      ]);
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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/purchases - List all purchases with optional filters
router.get('/', (req, res) => {
  try {
    const { filter } = req.query;
    let whereClause = '';
    const params = [];

    if (filter) {
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
    
    // Fetch items for each purchase (including qty and nos)
    const purchasesWithItems = purchases.map(p => {
      const items = query(
        "SELECT item_name, qty, nos, amount FROM purchase_items WHERE purchase_id = ?",
        [p.id]
      );
      return { ...p, items };
    });

    return res.json({ success: true, purchases: purchasesWithItems });
  } catch (err) {
    console.error('Error fetching purchases:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/purchases/:id - Get single purchase with items
router.get('/:id', (req, res) => {
  try {
    const purchase = get("SELECT * FROM purchases WHERE id = ?", [req.params.id]);
    
    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    const items = query(
      "SELECT item_name, qty, nos, amount FROM purchase_items WHERE purchase_id = ?",
      [purchase.id]
    );
    
    return res.json({ success: true, purchase: { ...purchase, items } });
  } catch (err) {
    console.error('Error fetching purchase:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/purchases/:id - Delete purchase
router.delete('/:id', (req, res) => {
  try {
    const purchase = get("SELECT * FROM purchases WHERE id = ?", [req.params.id]);
    
    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    // Delete items first (FK constraint)
    run("DELETE FROM purchase_items WHERE purchase_id = ?", [req.params.id]);
    
    // Delete purchase
    run("DELETE FROM purchases WHERE id = ?", [req.params.id]);

    return res.json({ success: true, message: 'Purchase deleted' });
  } catch (err) {
    console.error('Error deleting purchase:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// PUT /api/purchases/:id - Update purchase
router.put('/:id', (req, res) => {
  try {
    const { shopName, items } = req.body;
    const purchaseId = req.params.id;
    
    if (!shopName || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Shop name and items required' });
    }

    const purchase = get("SELECT * FROM purchases WHERE id = ?", [purchaseId]);
    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    // Filter valid items
    const validItems = items.filter(item => item.name && item.name.trim() !== '');
    if (validItems.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one item with a name is required' });
    }

    // Calculate new total
    const totalAmount = validItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const itemCount = validItems.length;

    // Update purchase
    run(
      `UPDATE purchases 
       SET shop_name = ?, total_amount = ?, item_count = ?, updated_at = datetime('now','localtime')
       WHERE id = ?`,
      [shopName, totalAmount, itemCount, purchaseId]
    );

    // Delete old items
    run("DELETE FROM purchase_items WHERE purchase_id = ?", [purchaseId]);

    // Insert new items with qty and nos
    const stmt = "INSERT INTO purchase_items (purchase_id, item_name, qty, nos, amount) VALUES (?, ?, ?, ?, ?)";
    validItems.forEach(item => {
      run(stmt, [
        purchaseId,
        item.name.trim(),
        parseFloat(item.qty || 0),
        parseInt(item.nos || 0),
        parseFloat(item.amount || 0)
      ]);
    });

    return res.json({ 
      success: true, 
      message: 'Purchase updated successfully',
      purchase_id: purchaseId,
      shop_name: shopName,
      total_amount: totalAmount,
      item_count: itemCount
    });
  } catch (err) {
    console.error('Error updating purchase:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
