import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on_connect('Client error', (err) => {
      console.log(`Error ${err}`);
    });
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    const value = await promisify(this.client.get).bind(this.client)(key);
    return value;
  }

  async set(key, value, duration) {
    await promisify(this.client.set).bind(this.client)(key, value);
    await promisify(this.client.expire).bind(this.client)(key, duration);
    await this.client.expire(key, duration);
  }

  async del(key) {
    await promisify(this.client.del).bind(this.client)(key);
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
