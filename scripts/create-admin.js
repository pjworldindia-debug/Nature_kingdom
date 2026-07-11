const bcrypt = require('bcrypt');
const pool = require('../config/database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('--- Nature Kingdom Admin Creator ---');

rl.question('Admin Name: ', (name) => {
  rl.question('Admin Email: ', (email) => {
    rl.question('Admin Password: ', async (password) => {
      try {
        const hash = await bcrypt.hash(password, 12);
        await pool.query(
          `INSERT INTO users (name, email, password_hash, role, email_verified) 
           VALUES ($1, $2, $3, 'admin', TRUE)`,
          [name, email, hash]
        );
        console.log(`✓ Admin user ${email} created successfully.`);
      } catch (err) {
        console.error('Failed to create admin:', err.message);
      } finally {
        pool.end();
        rl.close();
      }
    });
  });
});
