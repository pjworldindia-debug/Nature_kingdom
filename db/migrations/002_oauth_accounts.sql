-- One user can have multiple OAuth providers linked to their account.
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      VARCHAR(50) NOT NULL,     -- 'google' | 'github'
  provider_id   VARCHAR(255) NOT NULL,    -- the sub/id from the provider
  access_token  TEXT,                     -- encrypted at rest
  refresh_token TEXT,
  token_expires TIMESTAMPTZ,
  profile_data  JSONB,                    -- raw profile snapshot
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_accounts(provider, provider_id);

DROP TRIGGER IF EXISTS oauth_accounts_updated_at ON oauth_accounts;
CREATE TRIGGER oauth_accounts_updated_at
  BEFORE UPDATE ON oauth_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
