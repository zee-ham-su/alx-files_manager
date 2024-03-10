/* eslint-disable */
import { expect } from 'chai';
import dbClient from '../../utils/db';

describe('DBClient utility', () => {
  before(function (done) {
    this.timeout(10000);
    Promise.all([dbClient.usersCollection(), dbClient.filesCollection()])
      .then(([usersCollection, filesCollection]) => {
        Promise.all([usersCollection.deleteMany({}), filesCollection.deleteMany({})])
          .then(() => done())
          .catch((deleteErr) => done(deleteErr));
      }).catch((connectErr) => done(connectErr));
  });

  it('should indicate that the client is alive', () => {
    expect(dbClient.isAlive()).to.equal(true);
  });

  it('should return the correct number of users', async () => {
    expect(await dbClient.nbUsers()).to.equal(0);
  });

  it('should return the correct number of files', async () => {
    expect(await dbClient.nbFiles()).to.equal(0);
  });
});
