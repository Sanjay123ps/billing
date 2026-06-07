const express = require('express');
const router = express.Router();
const { query, run, get } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Middleware: Check authentication
router.use(authenticateToken);

// GET /api/settings - Retrieve all settings
router.get('/', (req, res) => {
  try {
    const settings = get("SELECT * FROM settings WHERE id = 1");
    
    if (!settings) {
      // Return defaults if not found
      return res.json({ 
        success: true, 
        settings: {
          shop_name: 'Ayini Home Products',
          gstin_number: '',
          gst_rate: 0,
          theme_mode: 'dark',
          product_view: 'grid'
        }
      });
    }

    return res.json({ success: true, settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings - Update settings
router.put('/', (req, res) => {
  try {
    const { shopName, gstinNumber, gstRate, themeMode, productView } = req.body;

    // Validate inputs
    const gst = parseFloat(gstRate || 0);
    if (gst < 0 || gst > 100) {
      return res.status(400).json({ error: 'GST rate must be between 0 and 100' });
    }

    // Update settings
    run(
      `UPDATE settings 
       SET shop_name = ?, 
           gstin_number = ?, 
           gst_rate = ?, 
           theme_mode = ?, 
           product_view = ?,
           updated_at = datetime('now','localtime')
       WHERE id = 1`,
      [shopName || 'Ayini Home Products', gstinNumber || '', gst, themeMode || 'dark', productView || 'grid']
    );

    const updatedSettings = get("SELECT * FROM settings WHERE id = 1");

    return res.json({ 
      success: true, 
      message: 'Settings updated successfully',
      settings: updatedSettings
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/gst-rate - Quick fetch for current GST rate (used by billing page)
router.get('/gst-rate', (req, res) => {
  try {
    const settings = get("SELECT gst_rate FROM settings WHERE id = 1");
    const gstRate = settings?.gst_rate || 0;
    
    return res.json({ success: true, gst_rate: gstRate });
  } catch (err) {
    console.error('Error fetching GST rate:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
