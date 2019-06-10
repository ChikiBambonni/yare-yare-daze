'use strict';

const express = require('express');
const _ = require('lodash');
const { ObjectId } = require('mongodb');

const { CommonSchema } = require('../models/common.js');
const { ClientErrors, errorResponse } = require('../utils/errors.js');
const { getCollection } = require('../db/mongoose.js');
const { authHandler } = require('../middleware/authenticate.js');

const router = express.Router();
router.delete(`/${process.env.APP_PREFIX}/:database/users/token`, authHandler, async (req, res) => {
	try {
		await req.user.removeToken(req.token);
		return res.status(200).send();
	} catch (e) {
		return errorResponse(res, 400, e.message);
	}
});

router.delete(`/${process.env.APP_PREFIX}/:database/:collection/:_id`, authHandler, async (req, res, next) => {
	if (req.params._id === '*') {
		return next('route');
	}

	try {
		const { _id } = req.params;

		if (!ObjectId.isValid(_id)) {
			throw new Error(ClientErrors.INVALID_ID);
		}

		const collection = getCollection(req.params.database, req.params.collection, CommonSchema);
		const document = await collection.findOneAndRemove({ _id }, { useFindAndModify: false });

		if (!document) {
			return errorResponse(res, 404, 'Not Found');
		}
 
		return res.status(200).send(document);
	} catch (e) {
		return errorResponse(res, 400, e.message);
	}
});

// Bulk DELETE
router.delete(`/${process.env.APP_PREFIX}/:database/:collection/*`, authHandler, async (req, res) => {
	try {
		const filter = req.query.filter !== undefined 
			? JSON.parse(_.replace(req.query.filter, new RegExp('\'','g'), '"')) : '';

		const collection = getCollection(req.params.database, req.params.collection, CommonSchema);
		const documents = await collection.deleteMany(filter);

		return res.status(200).send({
			inserted: 0,
			deleted: documents.n,
			modified: 0,
			matched: 0
		});
	} catch (e) {
		return errorResponse(res, 400, e.message);
	}
});

module.exports = router;
