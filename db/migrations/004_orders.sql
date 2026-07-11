CREATE TABLE IF NOT EXISTS orders (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  order_number        VARCHAR(50) UNIQUE NOT NULL,
  status              VARCHAR(30) DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','processing','shipped','delivered','cancelled','refunded')),
  subtotal            NUMERIC(10,2) NOT NULL,
  discount            NUMERIC(10,2) DEFAULT 0,
  tax                 NUMERIC(10,2) DEFAULT 0,
  shipping            NUMERIC(10,2) DEFAULT 0,
  total               NUMERIC(10,2) NOT NULL,
  currency            CHAR(3) DEFAULT 'INR',
  phonepe_transaction_id VARCHAR(255),
  phonepe_provider_reference_id VARCHAR(255),
  payment_status      VARCHAR(30) DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','paid','failed','refunded')),
  shipping_name       VARCHAR(255),
  shipping_address    JSONB,              -- {line1, line2, city, state, pin, country}
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phonepe ON orders(phonepe_transaction_id);

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  name        VARCHAR(255) NOT NULL,        -- snapshot at purchase time
  price       NUMERIC(10,2) NOT NULL,       -- snapshot at purchase time
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  subtotal    NUMERIC(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
