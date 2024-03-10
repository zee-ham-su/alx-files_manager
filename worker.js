import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import { promises as fs } from 'fs';
import { ObjectID } from 'mongodb';
import dbClient from './utils/db';

const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');
const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

async function generateThumbnails(fileId, userId, localPath) {
  const sizes = [500, 250, 100];
  const thumbnails = await Promise.all(sizes.map(async (size) => {
    const thumbnail = await imageThumbnail(localPath, { width: size });
    return { size, thumbnail };
  }));

  await Promise.all(thumbnails.map(async ({ size, thumbnail }) => {
    const outputPath = `${localPath}_${size}`;
    await fs.writeFile(outputPath, thumbnail);
  }));
}

fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    return done(new Error('Missing fileId'));
  }

  if (!userId) {
    return done(new Error('Missing userId'));
  }

  try {
    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(fileId);
    const file = await files.findOne({ _id: idObject });

    if (!file) {
      return done(new Error('File not found'));
    }

    await generateThumbnails(fileId, userId, file.localPath);
    done();
  } catch (error) {
    done(error);
  }
});

userQueue.process(async (job, done) => {
  const { userId } = job.data;

  if (!userId) {
    return done(new Error('Missing userId'));
  }

  try {
    const users = dbClient.db.collection('users');
    const idObject = new ObjectID(userId);
    const user = await users.findOne({ _id: idObject });

    if (user) {
      console.log(`Welcome ${user.email}!`);
      done();
    } else {
      done(new Error('User not found'));
    }
  } catch (error) {
    done(error);
  }
});
