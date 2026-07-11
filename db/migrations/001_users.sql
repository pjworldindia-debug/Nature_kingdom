CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE,            -- nullable for OAuth-only users initially
  password_hash VARCHAR(255),                   -- NULL for pure OAuth users
  role          VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  avatar_url    TEXT,                            -- from OAuth provider or null
  is_active     BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  login_attempts INTEGER DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Avoid error if trigger already exists by checking or just dropping first if needed
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
