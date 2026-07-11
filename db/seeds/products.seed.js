const pool = require('../../config/database');

const products = [
  {
    name: 'Himalayan Sea Buckthorn Oil',
    kingdom: 'sea-buckthorn',
    slug: 'sea-buckthorn-oil',
    tagline: 'The Ultimate Omega-7 Elixir',
    description: 'Sourced from the high altitudes of the Himalayas, our Sea Buckthorn oil is cold-pressed to preserve maximum nutrient density. Rich in Omega 3, 6, 9, and the rare Omega 7.',
    price: 3499.00,
    compare_price: 4999.00,
    stock: 150,
    weight_grams: 30,
    sku: 'NK-SB-001',
    images: JSON.stringify([
      { url: 'https://images.unsplash.com/photo-1615486171448-43457a1458e0?w=800', alt: 'Himalayan Sea Buckthorn Oil Bottle', width: 800, height: 800 }
    ]),
    nutrients: JSON.stringify([
      { name: 'Omega 7', amount: '35%', unit: 'per serving', benefit: 'Skin hydration and elasticity' },
      { name: 'Vitamin C', amount: '12x', unit: 'more than oranges', benefit: 'Immunity and collagen' }
    ]),
    research: JSON.stringify([
      { title: 'Effects of Sea Buckthorn on Skin', institution: 'Dermatology Res', year: 2021, finding: 'Improved skin hydration by 40%', doi: '10.123/sb' }
    ]),
    is_active: true
  },
  {
    name: 'Pure Himalayan Shilajit Resin',
    kingdom: 'shilajit',
    slug: 'pure-shilajit-resin',
    tagline: 'The Conqueror of Mountains',
    description: 'Authentic gold-grade Shilajit purified using traditional Ayurvedic methods. Rich in Fulvic Acid and 85+ trace minerals for natural energy and stamina.',
    price: 2999.00,
    compare_price: 3999.00,
    stock: 200,
    weight_grams: 20,
    sku: 'NK-SH-001',
    images: JSON.stringify([
      { url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800', alt: 'Pure Himalayan Shilajit Resin Jar', width: 800, height: 800 }
    ]),
    nutrients: JSON.stringify([
      { name: 'Fulvic Acid', amount: '> 60%', unit: 'concentration', benefit: 'Nutrient absorption' },
      { name: 'Trace Minerals', amount: '85+', unit: 'minerals', benefit: 'Cellular energy' }
    ]),
    research: JSON.stringify([
      { title: 'Shilajit as a testosterone booster', institution: 'Andrology Journal', year: 2015, finding: 'Significant increase in free testosterone', doi: '10.123/sh' }
    ]),
    is_active: true
  },
  {
    name: 'Organic Himalayan Stevia Drops',
    kingdom: 'stevia',
    slug: 'organic-stevia-drops',
    tagline: 'Zero Calories. Infinite Sweetness.',
    description: 'Pure stevia leaf extract grown organically in the Himalayan foothills. No bitter aftertaste, no artificial additives. Perfect for your daily wellness drinks.',
    price: 599.00,
    compare_price: 899.00,
    stock: 500,
    weight_grams: 50,
    sku: 'NK-ST-001',
    images: JSON.stringify([
      { url: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=800', alt: 'Organic Stevia Liquid Drops', width: 800, height: 800 }
    ]),
    nutrients: JSON.stringify([
      { name: 'Steviol Glycosides', amount: '98%', unit: 'purity', benefit: 'Zero calorie sweetness' }
    ]),
    research: JSON.stringify([
      { title: 'Stevia and Blood Sugar', institution: 'Endocrine Society', year: 2018, finding: 'No insulin spike observed', doi: '10.123/st' }
    ]),
    is_active: true
  }
];

async function seedProducts() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Clear existing products for idempotency
    await client.query('TRUNCATE TABLE products CASCADE');
    
    for (const p of products) {
      await client.query(
        `INSERT INTO products 
         (name, kingdom, slug, tagline, description, price, compare_price, stock, weight_grams, sku, images, nutrients, research, is_active) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14)`,
        [p.name, p.kingdom, p.slug, p.tagline, p.description, p.price, p.compare_price, p.stock, p.weight_grams, p.sku, p.images, p.nutrients, p.research, p.is_active]
      );
    }

    await client.query('COMMIT');
    console.log('✓ Products seeded successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

seedProducts();
