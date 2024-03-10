/* eslint-disable */
/* eslint-disable import/no-named-as-default */
import { tmpdir } from 'os';

import { join as joinPath } from 'path';
import { existsSync, readdirSync, unlinkSync, statSync } from 'fs';
import dbClient from '../../utils/db';

describe('+ FilesController', () => {
  const baseDir = `${process.env.FOLDER_PATH || ''}`.trim().length > 0
    ? process.env.FOLDER_PATH.trim()
    : joinPath(tmpdir(), DEFAULT_ROOT_FOLDER);
  const mockUser = {
    email: 'katakuri@bigmom.com',
    password: 'mochi_mochi_whole_cake',
  };

  const mockFiles = [
    {
      name: 'manga_titles.txt',
      type: 'file',
      data: [
        '+ Darwin\'s Game',
        '+ One Piece',
        '+ My Hero Academia',
        '',
      ].join('\n'),
      b64Data() { return Buffer.from(this.data, 'utf-8').toString('base64'); },
    },
    {
      name: 'One_Piece',
      type: 'folder',
      data: '',
      b64Data() { return ''; },
    },
    {
      name: 'chapter_titles.md',
      type: 'file',
      data: [
        '+ Chapter 47: The skies above the capital',
        '+ Chapter 48: 20 years',
        '+ Chapter 49: The world you wish for',
        '+ Chapter 50: Honor',
        '+ Chapter 51: The shogun of Wano - Kozuki Momonosuke',
        '+ Chapter 52: New morning',
        '',
      ].join('\n'),
      b64Data() { return Buffer.from(this.data, 'utf-8').toString('base64'); },
    },
  ];

  let token = '';

  const emptyFolder = (name) => {
    if (!existsSync(name)) {
      return;
    }
    for (const fileName of readdirSync(name)) {
      const filePath = joinPath(name, fileName);
      if (statSync(filePath).isFile) {
        unlinkSync(filePath);
      } else {
        emptyFolder(filePath);
      }
    }
  };

  const emptyDatabaseCollections = (callback) => {
    Promise.all([dbClient.usersCollection(), dbClient.filesCollection()])
      .then(([usersCollection, filesCollection]) => {
        Promise.all([usersCollection.deleteMany({}), filesCollection.deleteMany({})])
          .then(() => {
            if (callback) {
              callback();
            }
          })
          .catch((deleteErr) => done(deleteErr));
      }).catch((connectErr) => done(connectErr));
  };

  const signUp = (user, callback) => {
    request.post('/users')
      .send({ email: user.email, password: user.password })
      .expect(201)
      .end((requestErr, res) => {
        if (requestErr) {
          return callback ? callback(requestErr) : requestErr;
        }
        expect(res.body.email).to.eql(user.email);
        expect(res.body.id.length).to.be.greaterThan(0);
        if (callback) {
          callback();
        }
      });
  };

  const signIn = (user, callback) => {
    request.get('/connect')
      .auth(user.email, user.password, { type: 'basic' })
      .expect(200)
      .end((requestErr, res) => {
        if (requestErr) {
          return callback ? callback(requestErr) : requestErr;
        }
        expect(res.body.token).to.exist;
        expect(res.body.token.length).to.be.greaterThan(0);
        token = res.body.token;
        if (callback) {
          callback();
        }
      });
  };

  before(function (done) {
    this.timeout(10000);
    emptyDatabaseCollections(() => signUp(mockUser, () => signIn(mockUser, done)));
    emptyFolder(baseDir);
  });

  after(function (done) {
    this.timeout(10000);
    setTimeout(() => {
      emptyDatabaseCollections(done);
      emptyFolder(baseDir);
    });
  });

    describe('+ POST: /files', () => {
  it('+ Fails with no "X-Token" header field', function (done) {
    request.post('/files')
      .expect(401)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        expect(res.body).to.deep.eql({ error: 'Unauthorized' });
        done();
      });
  });

  it('+ Fails for a non-existent user', function (done) {
    request.post('/files')
      .set('X-Token', 'raboof')
      .expect(401)
      .end((requestErr, res) => {
        if (requestErr) {
          return done(requestErr);
        }
        expect(res.body).to.deep.eql({ error: 'Unauthorized' });
        done();
      });
  });

  it('+ Fails if name is missing', function (done) {
    request.post('/files')
      .set('X-Token', token)
      .send({})
      .expect(400)
      .end((requestErr, res) => {
        if (requestErr) {
          return done(requestErr);
        }
        expect(res.body).to.deep.eql({ error: 'Missing name' });
        done();
      });
  });
        });
})
