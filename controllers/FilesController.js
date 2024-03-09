import { ObjectID } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fs = require('fs');
const mime = require('mime-types');

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
      const parentFile = await dbClient.files.findOne({ _id: new ObjectID(parentId) });
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

    try {
      const result = await dbClient.db.collection('files').insertOne(newFileDoc);
      const insertedId = result.insertedId.toHexString();

      if (type === 'folder') {
        const newFolder = {
          id: insertedId,
          userId: newFileDoc.userId,
          name: newFileDoc.name,
          type: newFileDoc.type,
          isPublic: newFileDoc.isPublic,
          parentId: newFileDoc.parentId,
        };
        return res.status(201).json(newFolder);
      }
      const newFile = {
        userId: newFileDoc.userId,
        name: newFileDoc.name,
        type: newFileDoc.type,
        isPublic: newFileDoc.isPublic,
        parentId: newFileDoc.parentId,
        _id: insertedId,
      };
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
      files.find(query).limit(20).skip(pageInt * 20).toArray((err, newFileDoc) => {
        if (err) {
          reject(new Error('Internal Server Error'));
          return;
        }
        resolve(newFileDoc);
      });
    })
      .then((newFileDoc) => {
        res.status(200).json(newFileDoc);
      })
      .catch((error) => {
        res.status(500).json({ error: error.message });
      });
  }

  static async putPublish(req, res) {
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
    await files.updateOne({ _id: idObject }, { $set: { isPublic: true } });
    return res.status(200).json({ ...file, isPublic: true });
  }

  static async putUnpublish(req, res) {
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
    await files.updateOne({ _id: idObject }, { $set: { isPublic: false } });
    return res.status(200).json({ ...file, isPublic: false });
  }

  static async getFile(req, res) {
    const { id } = req.params;
    const idObject = new ObjectID(id);
    const files = dbClient.db.collection('files');
    files.findOne({ _id: idObject }, async (err, file) => {
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }
      console.log(file.localPath);
      if (file.isPublic) {
        if (file.type === 'folder') {
          return res.status(400).json({ error: "A folder doesn't have content" });
        }
        try {
          let fileName = file.localPath;
          const size = req.param('size');
          if (size) {
            fileName = `${file.localPath}_${size}`;
          }
          const data = await fs.readFile(fileName);
          const contentType = mime.contentType(file.name);
          return res.header('Content-Type', contentType).status(200).send(data);
        } catch (error) {
          console.log(error);
          return res.status(404).json({ error: 'Not found' });
        }
      } else {
        const user = await FilesController.getUser(req);
        if (!user) {
          return res.status(404).json({ error: 'Not found' });
        }
        if (file.userId.toString() === user._id.toString()) {
          if (file.type === 'folder') {
            return res.status(400).json({ error: "A folder doesn't have content" });
          }
          try {
            let fileName = file.localPath;
            const size = req.param('size');
            if (size) {
              fileName = `${file.localPath}_${size}`;
            }
            const contentType = mime.contentType(file.name);
            return res.header('Content-Type', contentType).status(200).sendFile(fileName);
          } catch (error) {
            console.log(error);
            return res.status(404).json({ error: 'Not found' });
          }
        } else {
          console.log(`Wrong user: file.userId=${file.userId}; userId=${user._id}`);
          return res.status(404).json({ error: 'Not found' });
        }
      }
    });
  }
}

module.exports = FilesController;
