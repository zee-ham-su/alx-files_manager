import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(req, res) {
    if (redisClient.isAlive() && dbClient.isAlive()) {
      res.json({
        redis: true,
        db: true,
      });
      res.end();
    }
  }

  static async getStats(req, res) {
    const stats = {
      users: await dbClient.nbUsers(),
      files: await dbClient.nbFiles(),
    };
    return res.status(200).json(stats);
  }
}

module.exports = AppController;
