const router = require('express').Router();
const { query, get } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/reports/summary  — overall totals
router.get('/summary', authMiddleware, (req, res) => {
  const totals     = get("SELECT COUNT(*) as bill_count, SUM(total) as revenue, AVG(total) as avg_bill FROM bills");
  const ctr        = get("SELECT count FROM bill_counter WHERE id=1");
  const next_bill_no = ctr ? ctr.count : 1;
  // Use SQLite date to match created_at
  const todayData  = get("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM bills WHERE date(created_at,'localtime')=date('now','localtime')");
  const stockStats = get("SELECT COUNT(*) as total, SUM(CASE WHEN stock=0 THEN 1 ELSE 0 END) as out_of_stock, SUM(CASE WHEN stock>0 AND stock<=10 THEN 1 ELSE 0 END) as low_stock, SUM(price*stock) as stock_value FROM products");

  res.json({
    next_bill_no,
    all_time: {
      bill_count: totals?.bill_count || 0,
      revenue:    parseFloat((totals?.revenue || 0).toFixed(2)),
      avg_bill:   parseFloat((totals?.avg_bill || 0).toFixed(2)),
    },
    today: {
      bill_count: todayData?.count || 0,
      revenue:    parseFloat((todayData?.revenue || 0).toFixed(2)),
    },
    inventory: {
      total_products: stockStats?.total || 0,
      out_of_stock:   stockStats?.out_of_stock || 0,
      low_stock:      stockStats?.low_stock || 0,
      stock_value:    parseFloat((stockStats?.stock_value || 0).toFixed(2)),
    }
  });
});

// GET /api/reports/daily?days=30  — daily revenue for chart
router.get('/daily', authMiddleware, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const rows = query(
    `SELECT date(created_at,'localtime') as day,
            COUNT(*) as bills,
            ROUND(SUM(total),2) as revenue
     FROM bills
     WHERE date(created_at,'localtime') >= date('now','localtime','-${days} days')
     GROUP BY day
     ORDER BY day ASC`
  );
  res.json(rows);
});

// GET /api/reports/top-products?limit=10
router.get('/top-products', authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const rows = query(
    `SELECT name, SUM(qty) as total_qty, SUM(total) as total_revenue
     FROM bill_items
     GROUP BY name
     ORDER BY total_qty DESC
     LIMIT ?`,
    [limit]
  );
  res.json(rows);
});

// GET /api/reports/payment-breakdown
router.get('/payment-breakdown', authMiddleware, (req, res) => {
  const rows = query(
    `SELECT payment_mode, COUNT(*) as count, ROUND(SUM(total),2) as revenue
     FROM bills GROUP BY payment_mode ORDER BY count DESC`
  );
  res.json(rows);
});

// GET /api/reports/category-sales
router.get('/category-sales', authMiddleware, (req, res) => {
  const rows = query(
    `SELECT p.category, SUM(bi.qty) as total_qty, ROUND(SUM(bi.total),2) as revenue
     FROM bill_items bi
     LEFT JOIN products p ON bi.product_id = p.id
     WHERE p.category IS NOT NULL
     GROUP BY p.category
     ORDER BY revenue DESC`
  );
  res.json(rows);
});

module.exports = router;
