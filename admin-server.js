const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'admin_secret_key_123',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Serve static admin files
app.use(express.static(path.join(__dirname, 'admin-public')));

// Root redirect
app.get('/', (req, res) => res.redirect('/login.html'));
// Auth Middleware
const requireAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Login Route
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'pjworld26@gmail.com' && password === 'PJworldindia@26') {
        req.session.isAuthenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Logout Route
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check Auth Route
app.get('/api/admin/check-auth', (req, res) => {
    if (req.session.isAuthenticated) {
        res.json({ authenticated: true });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

// --- ORDERS API ---
app.get('/api/admin/orders', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, user_id, status, total, payment_status, created_at 
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- PRODUCTS API ---
app.get('/api/admin/products', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/admin/products/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { price, stock } = req.body;
    try {
        await pool.query('UPDATE products SET price = $1, stock = $2 WHERE id = $3', [price, stock, id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Full product update
app.put('/api/admin/products/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, tagline, price, stock, kingdom, is_active } = req.body;
    try {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        await pool.query(
            `UPDATE products SET name = $1, tagline = $2, price = $3, stock = $4, kingdom = $5, is_active = $6, slug = $7, updated_at = NOW() WHERE id = $8`,
            [name, tagline, price, stock, kingdom, is_active, slug, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete product
app.delete('/api/admin/products/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- IMAGES API ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, 'public', 'images');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.post('/api/admin/products', requireAuth, upload.single('image'), async (req, res) => {
    const { name, tagline, price, kingdom, stock } = req.body;
    if (!req.file || !name || !price || !kingdom) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const imagePath = '/images/' + req.file.filename;
        const imagesJson = JSON.stringify([{ url: imagePath, alt: name }]);
        const stockVal = stock ? parseInt(stock, 10) : 0;
        
        await pool.query(
            'INSERT INTO products (name, slug, kingdom, tagline, price, stock, images) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [name, slug, kingdom, tagline, price, stockVal, imagesJson]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error while creating product' });
    }
});

// Update product image
app.post('/api/admin/products/:id/image', requireAuth, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }
    try {
        const imageUrl = '/images/' + req.file.filename;
        const imagesJson = JSON.stringify([{ url: imageUrl, alt: 'product' }]);
        await pool.query('UPDATE products SET images = $1, updated_at = NOW() WHERE id = $2', [imagesJson, id]);
        res.json({ success: true, imageUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error while updating image' });
    }
});
const htmlFilesToScan = [
    'index.html',
    'products/shilajit.html',
    'products/sea-buckthorn.html',
    'products/stevia.html'
];

app.get('/api/admin/images', requireAuth, (req, res) => {
    try {
        let allImages = [];
        const publicDir = path.join(__dirname, 'public');
        
        for (const file of htmlFilesToScan) {
            const filePath = path.join(publicDir, file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                // Regex to extract src and alt from <img ...>
                const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
                let match;
                while ((match = imgRegex.exec(content)) !== null) {
                    const src = match[1];
                    let alt = 'Unknown';
                    const altMatch = match[0].match(/alt="([^"]+)"/i);
                    if (altMatch) alt = altMatch[1];
                    
                    allImages.push({
                        file: file,
                        src: src,
                        alt: alt
                    });
                }
            }
        }
        res.json(allImages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error reading HTML files' });
    }
});

app.post('/api/admin/images/replace', requireAuth, upload.single('image'), (req, res) => {
    const { file, oldSrc } = req.body;
    if (!req.file || !file || !oldSrc) {
        return res.status(400).json({ error: 'Missing data' });
    }
    
    try {
        const newSrc = '/images/' + req.file.filename;
        const filePath = path.join(__dirname, 'public', file);
        
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf-8');
            // Global replace to ensure all occurrences are updated
            content = content.split(oldSrc).join(newSrc);
            fs.writeFileSync(filePath, content);
            res.json({ success: true, newSrc });
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update image' });
    }
});

app.listen(PORT, () => {
    console.log(`Admin portal running on http://localhost:${PORT}`);
});
