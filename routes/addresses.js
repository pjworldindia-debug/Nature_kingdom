const express = require('express');
const pool = require('../config/database');
const { isAuthenticated } = require('../middleware/auth.middleware');

const router = express.Router();

// GET all addresses for the authenticated user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching addresses:', err);
    res.status(500).json({ error: 'Server error fetching addresses' });
  }
});

// POST a new address
router.post('/', isAuthenticated, async (req, res) => {
  const { street_address, city, state, postal_code, country } = req.body;
  if (!street_address || !city || !state || !postal_code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const { rows } = await pool.query(
      `INSERT INTO user_addresses (user_id, street_address, city, state, postal_code, country)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, street_address, city, state, postal_code, country || 'India']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error saving address:', err);
    res.status(500).json({ error: 'Server error saving address' });
  }
});

// DELETE an address
router.delete('/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM user_addresses WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Address not found or unauthorized' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting address:', err);
    res.status(500).json({ error: 'Server error deleting address' });
  }
});

module.exports = router;
