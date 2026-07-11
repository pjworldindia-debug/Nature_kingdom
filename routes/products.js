const express = require('express');
const pool = require('../config/database');
const cacheService = require('../services/cache.service');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const kingdom = req.query.kingdom;
    const cacheKey = kingdom ? `products:all:${kingdom}` : 'products:all';
    
    const cached = await cacheService.get(cacheKey);
    if (cached) return res.json(cached);

    let query = 'SELECT * FROM products WHERE is_active = TRUE';
    let params = [];
    if (kingdom) {
        query += ' AND kingdom = $1';
        params.push(kingdom);
    }
    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);
    await cacheService.set(cacheKey, rows, 300); // 5 mins
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const cached = await cacheService.get(`product:${slug}`);
    if (cached) return res.json(cached);

    const { rows } = await pool.query('SELECT * FROM products WHERE slug = $1 AND is_active = TRUE', [slug]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    
    await cacheService.set(`product:${slug}`, rows[0], 600); // 10 mins
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
