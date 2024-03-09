const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class AppController {
  static async getStatus(req, res) {
    const redisIsAlive = redisClient.isAlive();
    const dbIsAlive = dbClient.isAlive();

    if (redisIsAlive && dbIsAlive) {
      return res.status(200).json({ redis: true, db: true });
    }
    return res.status(500).json({ redis: redisIsAlive, db: dbIsAlive });
  }

  static async getStats(req, res) {
    const nUsers = await dbClient.client
      .db(dbClient.dbName)
      .collection('users')
      .countDocuments();
    const nFiles = await dbClient.client
      .db(dbClient.dbName)
      .collection('files')
      .countDocuments();
    return res.status(200).json({ users: nUsers, files: nFiles });
  }
}

module.exports = AppController;
