const NodeCache = require('node-cache');
const redis     = require('../config/redis');

class CacheService {
  constructor() {
    this.L1 = new NodeCache({ stdTTL: 60, checkperiod: 120 }); // in-process, 60s
  }

  async get(key) {
    const l1 = this.L1.get(key);
    if (l1 !== undefined) return l1;
    
    // Check if redis is ready
    if (!redis.isReady) return null;

    const l2 = await redis.get(`nk:cache:${key}`);
    if (l2) {
      const parsed = JSON.parse(l2);
      this.L1.set(key, parsed);
      return parsed;
    }
    return null;
  }

  async set(key, value, ttl = 300) {
    this.L1.set(key, value, ttl);
    if (redis.isReady) {
      await redis.setEx(`nk:cache:${key}`, ttl, JSON.stringify(value));
    }
  }

  async del(key) {
    this.L1.del(key);
    if (redis.isReady) {
      await redis.del(`nk:cache:${key}`);
    }
  }

  async invalidate(pattern) {
    this.L1.flushAll(); // For simplicity, flush all L1 on any invalidation
    if (redis.isReady) {
      const keys = await redis.keys(`nk:cache:${pattern}`);
      if (keys.length) await redis.del(keys);
    }
  }
}

module.exports = new CacheService();
