CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  kingdom       VARCHAR(50) NOT NULL CHECK (kingdom IN ('sea-buckthorn','shilajit','stevia')),
  slug          VARCHAR(255) UNIQUE NOT NULL,
  tagline       TEXT,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL,
  compare_price NUMERIC(10,2),
  stock         INTEGER DEFAULT 0,
  weight_grams  INTEGER,
  sku           VARCHAR(100) UNIQUE,
  images        JSONB DEFAULT '[]',       -- [{url, alt, width, height}]
  nutrients     JSONB DEFAULT '[]',       -- [{name, amount, unit, benefit}]
  research      JSONB DEFAULT '[]',       -- [{title, institution, year, finding, doi}]
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_kingdom ON products(kingdom);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_kingdom_active ON products(kingdom, is_active);

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
