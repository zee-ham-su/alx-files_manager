import { v4 as uuidv4 } from 'uuid';
import { ObjectID } from 'mongodb';
import fs from 'fs';
import path from 'path';
import Queue from 'bull/lib/queue';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue');

class FilesController {
  static async getUser(request) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId) {
      const users = dbClient.db.collection('users');
      const idObject = new ObjectID(userId);
      const user = await users.findOne({ _id: idObject });
      if (!user) {
        return null;
      }
      return user;
    }
    return null;
  }

  static async postUpload(req, res) {
    const user = await FilesController.getUser(req);
    const { 'x-token': token } = req.headers;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId || userId !== user._id.toString()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type,
      parentId = '0', isPublic = false, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (type !== 'folder' && !['file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== '0') {
      const parentFile = await dbClient.files.find({ id: parentId });
      if (!parentFile || parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const newFileDoc = {
      userId,
      name,
      type,
      parentId,
      isPublic,
    };

    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const filePath = path.join(folderPath, uuidv4());

      fs.writeFileSync(filePath, data, 'base64');
      newFileDoc.localPath = filePath;

      if (type === 'image') {
        fileQueue.add(
          {
            userId: user._id,
            fileId: newFileDoc.insertedId,
          },
        );
      }
    }

    try {
      const result = await dbClient.db.collection('files').insertOne(newFileDoc);
      const newFile = { ...newFileDoc, _id: result.insertedId };
      return res.status(201).json(newFile);
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getShow(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const fileId = req.params.id;
    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(fileId);
    const file = await files.findOne({ _id: idObject, userId: user._id });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { parentId = '0', page = 0 } = req.query;

    const pageInt = page || 0;
    const files = dbClient.db.collection('files');
    let query;
    if (parentId === '0') {
      query = { userId: user._id, parentId };
    } else {
      try {
        const parentIdObject = new ObjectID(parentId);
        query = { userId: user._id, parentId: parentIdObject };
      } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
    }

    return new Promise((resolve, reject) => {
      files.find(query).limit(20).skip(pageInt * 20).toArray((err, result) => {
        if (err) {
          return reject(new Error('Internal Server Error'));
        }
        resolve(res.status(200).json(result));
      });
    });
  }
}
module.exports = FilesController;
