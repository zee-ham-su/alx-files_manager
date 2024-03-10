/* eslint-disable */
import { expect } from 'chai';
import redisClient from '../../utils/redis';

describe('RedisClient utility', () => {
  before(function (done) {
    this.timeout(10000);
    setTimeout(done, 4000);
  });

  it('should indicate that the client is alive', () => {
    expect(redisClient.isAlive()).to.equal(true);
  });

  it('should set and get a value', async function () {
    await redisClient.set('test_key', 345, 10);
    expect(await redisClient.get('test_key')).to.equal('345');
  });

  it('should handle an expired value', function (done) {
    this.timeout(3000);
    setTimeout(async () => {
      expect(await redisClient.get('test_key')).to.be.null;
      done();
    }, 2000);
  });

  it('should handle a deleted value', async function () {
    await redisClient.set('test_key', 345, 10);
    await redisClient.del('test_key');
    setTimeout(async () => {
      expect(await redisClient.get('test_key')).to.be.null;
    }, 2000);
  });
});
