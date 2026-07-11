CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  admin_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(50),
  entity_id   INTEGER,
  details     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
