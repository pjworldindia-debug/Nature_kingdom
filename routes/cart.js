const express = require('express');
const pool = require('../config/database');
const { isAuthenticated } = require('../middleware/auth.middleware');
const cacheService = require('../services/cache.service');
const router = express.Router();

// Get cart items
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const cacheKey = `cart:${req.user.id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await pool.query(`
      SELECT c.id, c.quantity, p.name, p.price, p.slug, p.images 
      FROM cart_items c 
      JOIN products p ON c.product_id = p.id 
      WHERE c.user_id = $1
    `, [req.user.id]);
    
    await cacheService.set(cacheKey, rows, 300); // cache for 5 mins
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add to cart
router.post('/', isAuthenticated, async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  
  if (!productId || quantity < 1) {
    return res.status(400).json({ error: 'Invalid product or quantity' });
  }

  try {
    // Check product exists and has stock
    const { rows: prodRows } = await pool.query('SELECT stock FROM products WHERE id = $1 AND is_active = TRUE', [productId]);
    if (!prodRows[0]) return res.status(404).json({ error: 'Product not found' });
    if (prodRows[0].stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    // Upsert cart item
    const { rows } = await pool.query(`
      INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
      RETURNING *
    `, [req.user.id, productId, quantity]);
    
    await cacheService.del(`cart:${req.user.id}`);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sync cart (merge guest cart)
router.post('/sync', isAuthenticated, async (req, res) => {
  const { cart } = req.body;
  if (!Array.isArray(cart)) return res.json({ success: true });

  try {
    for (const item of cart) {
      if (item.productId && item.quantity > 0) {
        // Upsert cart item
        await pool.query(`
          INSERT INTO cart_items (user_id, product_id, quantity)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
        `, [req.user.id, item.productId, item.quantity]);
      }
    }
    await cacheService.del(`cart:${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update quantity
router.put('/:id', isAuthenticated, async (req, res) => {
  const { quantity } = req.body;
  if (quantity < 1) return res.status(400).json({ error: 'Invalid quantity' });

  try {
    const { rows } = await pool.query(
      'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [quantity, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    
    await cacheService.del(`cart:${req.user.id}`);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove item
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    await cacheService.del(`cart:${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
