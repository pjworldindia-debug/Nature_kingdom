CREATE TABLE IF NOT EXISTS cart_items (
  id          SERIAL PRIMARY KEY,
  session_id  VARCHAR(255),
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_cart_owner CHECK (session_id IS NOT NULL OR user_id IS NOT NULL),
  UNIQUE NULLS NOT DISTINCT (session_id, product_id),
  UNIQUE NULLS NOT DISTINCT (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_id);
