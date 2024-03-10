import supertest from 'supertest';
import chai from 'chai';
import api from '../server';

global.app = api;
global.expect = chai.expect;
global.assert = chai.assert;
global.request = supertest(api);
