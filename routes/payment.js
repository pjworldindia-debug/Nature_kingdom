const express = require('express');
const crypto = require('crypto');
const pool = require('../config/database');
const { isAuthenticated } = require('../middleware/auth.middleware');
const { paymentLimiter } = require('../middleware/rateLimit.middleware');
const csurf = require('csurf');
const csrfProtection = csurf();
const router = express.Router();

const PHONEPE_ENV = process.env.PHONEPE_ENV || 'UAT';
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';

const BASE_URL = PHONEPE_ENV === 'LIVE' 
  ? 'https://api.phonepe.com/apis/hermes' 
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

// Initiate Payment (CSRF protected)
router.post('/initiate', csrfProtection, isAuthenticated, paymentLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Get cart items for user
    const { rows: cartItems } = await client.query(`
      SELECT c.quantity, p.id as product_id, p.name, p.price, p.stock
      FROM cart_items c 
      JOIN products p ON c.product_id = p.id 
      WHERE c.user_id = $1
      FOR UPDATE OF p
    `, [req.user.id]);

    if (!cartItems.length) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // 2. Calculate totals
    let subtotal = 0;
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}`);
      }
      subtotal += item.price * item.quantity;
    }

    const shipping = subtotal > 1500 ? 0 : 100;
    const total = subtotal + shipping;
    const orderNumber = `NK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 3. Create Order in DB
    const { rows: [order] } = await client.query(`
      INSERT INTO orders (user_id, order_number, subtotal, shipping, total, status)
      VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id
    `, [req.user.id, orderNumber, subtotal, shipping, total]);

    for (const item of cartItems) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, name, price, quantity, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [order.id, item.product_id, item.name, item.price, item.quantity, item.price * item.quantity]);
    }
    
    // 4. Construct PhonePe payload
    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: orderNumber,
      merchantUserId: `USER_${req.user.id}`,
      amount: Math.round(total * 100), // In paise
      redirectUrl: `${process.env.APP_URL}/order-success.html?orderId=${orderNumber}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${process.env.APP_URL}/api/payment/webhook`,
      mobileNumber: req.user.phone || '9999999999',
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const checksum = crypto.createHash('sha256').update(payloadBase64 + '/pg/v1/pay' + SALT_KEY).digest('hex') + '###' + SALT_INDEX;

    // 5. Call PhonePe API with Retry & Timeout Circuit
    let response;
    let attempt = 0;
    while (attempt < 3) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        response = await fetch(`${BASE_URL}/pg/v1/pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum
          },
          body: JSON.stringify({ request: payloadBase64 }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        break; // Success
      } catch (err) {
        attempt++;
        if (attempt >= 3) {
          throw new Error('Payment gateway timeout after retries');
        }
      }
    }

    const data = await response.json();

    if (data.success && data.data && data.data.instrumentResponse && data.data.instrumentResponse.redirectInfo) {
      await client.query('COMMIT');
      // Clear cart
      await pool.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
      
      res.json({ 
        success: true, 
        redirectUrl: data.data.instrumentResponse.redirectInfo.url,
        orderNumber
      });
    } else {
      throw new Error(data.message || 'Payment initiation failed');
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    client.release();
  }
});

// Webhook (S2S Callback from PhonePe — no CSRF, no auth)
router.post('/webhook', async (req, res) => {
  try {
    // PhonePe sends { response: base64 }
    const { response } = req.body;
    if (!response) return res.status(400).send('Invalid payload');
    
    // Validate signature sent in headers
    const receivedChecksum = req.headers['x-verify'];
    const calculatedChecksum = crypto.createHash('sha256').update(response + SALT_KEY).digest('hex') + '###' + SALT_INDEX;
    
    if (receivedChecksum !== calculatedChecksum) {
      return res.status(400).send('Signature mismatch');
    }

    const decoded = JSON.parse(Buffer.from(response, 'base64').toString('utf-8'));
    
    const merchantTransactionId = decoded.data.merchantTransactionId;
    const providerReferenceId = decoded.data.transactionId; // PhonePe transaction ID
    const state = decoded.code; // PAYMENT_SUCCESS etc

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      if (state === 'PAYMENT_SUCCESS') {
        // Idempotency check: lock the order row and check status
        const { rows: orderCheck } = await client.query(
          'SELECT status FROM orders WHERE order_number = $1 FOR UPDATE', 
          [merchantTransactionId]
        );
        
        if (orderCheck.length > 0 && orderCheck[0].status === 'paid') {
          await client.query('ROLLBACK');
          return res.status(200).send('OK - Idempotent');
        }

        // Update order status
        await client.query(`
          UPDATE orders 
          SET status = 'paid', payment_status = 'paid', phonepe_transaction_id = $1
          WHERE order_number = $2
        `, [providerReferenceId, merchantTransactionId]);

        // Deduct inventory for each ordered item
        const { rows: orderRows } = await client.query(
          'SELECT id FROM orders WHERE order_number = $1', [merchantTransactionId]
        );
        if (orderRows.length > 0) {
          const { rows: orderItems } = await client.query(
            'SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderRows[0].id]
          );
          for (const item of orderItems) {
            await client.query(
              'UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2',
              [item.quantity, item.product_id]
            );
          }
        }
      } else {
        await client.query(`
          UPDATE orders 
          SET status = 'pending', payment_status = 'failed', phonepe_transaction_id = $1
          WHERE order_number = $2
        `, [providerReferenceId, merchantTransactionId]);
      }
      
      await client.query('COMMIT');
    } catch(err) {
      await client.query('ROLLBACK');
      console.error(err);
    } finally {
      client.release();
    }
    
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Webhook error');
  }
});

module.exports = router;
