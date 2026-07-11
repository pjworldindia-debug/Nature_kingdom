const crypto = require('crypto');
require('dotenv').config();

// Default securely generated key for local dev if none is provided
const keyHex = process.env.TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const KEY    = Buffer.from(keyHex, 'hex'); // 32-byte key
const ALGO   = 'aes-256-gcm';

function encrypt(plaintext) {
  if (!plaintext) return null;
  const iv        = crypto.randomBytes(12);
  const cipher    = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag       = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext) {
  if (!ciphertext) return null;
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };
