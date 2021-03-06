'use strict';

const expect = require('expect');
const request = require('supertest');
const _ = require('lodash');

const { app } = require('../../app');
const { CommonSchema } = require('../../models/common.models');
const { UserSchema } = require('./../../models/users.models');
const { items, users, populateItems, populateUsers } = require('../../seed/seed.tests');
const { getCollection } = require('../../db/mongoose.db');
const { curry } = require('../../utils/core.utils');
const { test_timeout } = require('../constants/mocha.constants');
const { testDatabase, testCollection } = require('../constants/db.constants');

describe(`POST /${process.env.APP_PREFIX}/:database/:collection`, function () {
	this.timeout(test_timeout);
	beforeEach(curry(populateItems)(testDatabase, testCollection, CommonSchema, items));
	beforeEach(curry(populateUsers)(testDatabase, 'Users', UserSchema, users));

	it('should insert documents if _id is not specified', done => {
		const data = [{
			text: 'text 1',
			number: 2000
		}, {
			text: 'text 2',
			number: 3000
		}];

		request(app)
			.post(`/${process.env.APP_PREFIX}/${testDatabase}/${testCollection}`)
			.set('x-auth', users[0].tokens[0].token)
			.send(data)
			.expect(200)
			.expect(res => {
				expect(res.body).toMatchObject({
					inserted: data.length,
					deleted: 0,
					modified: 0,
					matched: 0
				});
			})
			.end(async (err, res) => {
				if (err) {
					return done(err);
				}

				const collection = await getCollection(testDatabase, testCollection, CommonSchema);
				const count = await collection.countDocuments({});
				const documents = await collection.find({
					_id: { $in: res.body._embedded.map(d => d._id )}
				});

				expect(documents.map(d => _.omit(d.toObject(), ['_id']))).toEqual(data);
				expect(count).toBe(items.length + data.length);
				done();
			});
	});

	it('should update documents if _id is specified', done => {
		const data = [{
			_id: items[items.length - 2]._id,
			text: 'text 2',
			number: 3000,
			TS: 0
		}, {
			_id: items[items.length - 1]._id,
			text: 'text 1',
			number: 2000,
			TS: 0
		}];

		request(app)
			.post(`/${process.env.APP_PREFIX}/${testDatabase}/${testCollection}`)
			.set('x-auth', users[0].tokens[0].token)
			.send(data)
			.expect(200)
			.expect(res => {
				expect(res.body).toEqual({
					_embedded: [],
					inserted: 0,
					deleted: 0,
					modified: data.length,
					matched: data.length
				});
			})
			.end(async (err, res) => {
				if (err) {
					return done(err);
				}

				const collection = await getCollection(testDatabase, testCollection, CommonSchema);
				const count = await collection.countDocuments({});
				const documents = await collection.find({
					_id: { $in: data.map(d => d._id )}
				});

				expect(documents.map(d => d.toObject())).toMatchObject(data);
				expect(count).toBe(items.length);
				done();
			});
	});

	it('should both update and insert', done => {
		const data = [{
			text: 'custom text',
		}, {
			_id: items[items.length - 1]._id,
			text: 'text 1',
			number: 2000,
			TS: 0
		}];

		request(app)
			.post(`/${process.env.APP_PREFIX}/${testDatabase}/${testCollection}`)
			.set('x-auth', users[0].tokens[0].token)
			.send(data)
			.expect(200)
			.expect(res => {
				expect(res.body).toMatchObject({
					inserted: data.filter(d => d._id === undefined).length,
					deleted: 0,
					modified: data.filter(d => d._id !== undefined).length,
					matched: data.filter(d => d._id !== undefined).length
				});
			})
			.end(async (err, res) => {
				if (err) {
					return done(err);
				}

				const collection = await getCollection(testDatabase, testCollection, CommonSchema);

				const count = await collection.countDocuments({});
				const updated = await collection.find({ _id: _.last(data)._id.toHexString() });
				const documents = await collection.find({
					_id: { $in: res.body._embedded.map(d => d._id )}
				});

				expect(count).toBe(items.length + data.length - updated.length);
				expect(updated[0].toObject()).toMatchObject(data[1]);
				expect(documents.map(d => _.omit(d.toObject(), ['_id']))[0]).toEqual(data[0]);
				done();
			});
	});

	it('should 400 if invalid Object id provided', done => {
		const data = [{
			text: 'custom text',
		}, {
			_id: '123qwerty',
			text: 'text 1',
			number: 2000,
			TS: 0
		}];

		request(app)
			.post(`/${process.env.APP_PREFIX}/${testDatabase}/${testCollection}`)
			.set('x-auth', users[0].tokens[0].token)
			.send(data)
			.expect(400)
			.end(done);
	});
});

describe(`POST /${process.env.APP_PREFIX}/:database/users`, function () {
	this.timeout(test_timeout);
	beforeEach(curry(populateUsers)(testDatabase, 'Users', UserSchema, users));
	before(function () {
		if (process.env.JWT_AUTH !== 'true') {
			this.skip();
		}
	});

	it('should create a user', done => {
		const email = 'dog123321@ukr.net';
		const password = 'password11111';

		request(app)
			.post(`/${process.env.APP_PREFIX}/${testDatabase}/users`)
			.send({ email, password })
			.expect(200)
			.expect(res => {
				expect(res.headers['x-auth']).toBeTruthy();
				expect(res.body._id).toBeTruthy();
				expect(res.body.email).toBe(email);
			})
			.end(async (err, res) => {
				if (err) {
					return done(err);
				}

				const User = await getCollection(testDatabase, 'Users', UserSchema);     

				User.findOne({ email }).then(user => {
					expect(user).toBeTruthy();
					expect(user.password).not.toBe(password);
					done();
				});
			});
	});

	it('should return validation errors if request invalid', done => {
		const email = 'do';
		const password = 'password11111';

		request(app)
			.post(`/${process.env.APP_PREFIX}/${testDatabase}/users`)
			.send({ email, password })
			.expect(400)
			.end(done);
	});

	it('should not create user if email in use', done => {
		const [ email ] = users;
		const password = 'userOnePass';

		request(app)
			.post(`/${process.env.APP_PREFIX}/${testDatabase}/users`)
			.send({ email, password })
			.expect(400)
			.end(done);
	});
});

describe(`POST /${process.env.APP_PREFIX}/${testDatabase}/users/login`, function () {
	this.timeout(test_timeout);
	beforeEach(curry(populateUsers)(testDatabase, 'Users', UserSchema, users));
	before(function () {
		if (process.env.JWT_AUTH !== 'true') {
			this.skip();
		}
	});

	it('should return logged user', done => {
		request(app)
			.post(`/${process.env.APP_PREFIX}/${testDatabase}/users/login`)
			.send({ email: users[1].email, password: users[1].password })
			.expect(200)
			.expect(res => {
				expect(res.headers['x-auth']).toBeTruthy();
			})
			.end(async (err, res) => {
				if (err) {
					return done(err);
				}
                
				const User = await getCollection(testDatabase, 'Users', UserSchema);     

				User.findById(users[1]._id).then(user => {
					expect(user.tokens[1]).toMatchObject({
						access: 'auth',
						token: res.headers['x-auth']
					});
					done();
				})
					.catch(e => done(e));
			});
	});

	it('should return 400 if invalid credentials', done => {
		request(app)
			.post(`/${process.env.APP_PREFIX}/${testDatabase}/users/login`)
			.send({ email: users[1].email, password: 'passValue' })
			.expect(400)
			.expect(res => {
				expect(res.headers['x-auth']).toBeFalsy();
			})
			.end(async (err, res) => {
				if (err) {
					return done(err);
				}

				const User = await getCollection(testDatabase, 'Users', UserSchema);     

				User.findById(users[1]._id).then(user => {
					expect(user.tokens.length).toBe(1);
					done();
				})
					.catch(e => done(e));
			});
	});
});
