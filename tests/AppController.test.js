/* eslint-disable */
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const dbClient = require('../utils/db');
const AppController = require('../controllers/AppController');

describe('+ AppController', () => {
  before(function (done) {
    this.timeout(10000);
    Promise.all([dbClient.usersCollection(), dbClient.filesCollection()])
      .then(([usersCollection, filesCollection]) => {
        Promise.all([usersCollection.deleteMany({}), filesCollection.deleteMany({})])
          .then(() => done())
          .catch((deleteErr) => done(deleteErr));
      }).catch((connectErr) => done(connectErr));
  });

  describe('+ GET: /status', () => {
    it('+ Services are online', () => new Promise((done) => {
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      AppController.getStatus({}, res).then(() => {
        sinon.assert.calledOnce(res.status);
        sinon.assert.calledWith(res.status, 200);
        sinon.assert.calledOnce(res.json);
        sinon.assert.calledWith(res.json, { redis: true, db: true });
        done();
      }).catch(done);
    }));
  });

  describe('+ GET: /stats', () => {
    it('+ Correct statistics about db collections', () => new Promise((done) => {
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      AppController.getStats({}, res).then(() => {
        sinon.assert.calledOnce(res.status);
        sinon.assert.calledWith(res.status, 200);
        sinon.assert.calledOnce(res.json);
        sinon.assert.calledWith(res.json, { users: 0, files: 0 });
        done();
      }).catch(done);
    }));

    it('+ Correct statistics about db collections [alt]', function () {
      return new Promise((done) => {
        this.timeout(10000);
        sinon.stub(dbClient, 'usersCollection').resolves({
          insertMany: sinon.stub().resolves(),
        });
        sinon.stub(dbClient, 'filesCollection').resolves({
          insertMany: sinon.stub().resolves(),
        });

        AppController.getStats({}, {
          status: sinon.stub().returnsThis(),
          json: sinon.stub(),
        }).then(() => {
          sinon.assert.calledOnce(dbClient.usersCollection);
          sinon.assert.calledOnce(dbClient.filesCollection);
          sinon.assert.calledTwice(res.insertMany);
          sinon.assert.calledOnce(res.status);
          sinon.assert.calledWith(res.status, 200);
          sinon.assert.calledOnce(res.json);
          sinon.assert.calledWith(res.json, { users: 1, files: 2 });
          dbClient.usersCollection.restore();
          dbClient.filesCollection.restore();
          done();
        }).catch(done);
      });
    });
  });
});
