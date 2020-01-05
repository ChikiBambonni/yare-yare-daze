'use strict';

const { ObjectID } = require('mongodb');

const { CommonSchema } = require('../models/common.models');
const { getCollection } = require('../db/mongoose.db');

const update_document = async (req, res, next) => {
	try {
		const { _id } = req.params;
		if (!ObjectId.isValid(_id)) {
			throw new Error(clientErrors.INVALID_ID);
		}

		const collection = await getCollection(req.params.database, req.params.collection, CommonSchema);
		const document = await collection.findOneAndUpdate({ _id }, req.body);

		if (!document) {
			return next(notFoundError());
		}

		return res.status(200).send(document);
	} catch (err) {
		return next(err);
	}
};

const update_documents = async (req, res, next) => {
	try {
		const _id = req.body._id ? req.body._id : new ObjectID(); 

		const collection = await getCollection(req.params.database, req.params.collection, CommonSchema);
		const document = await collection.findOneAndUpdate({ _id }, 
			{ ...req.body } , { upsert: true, useFindAndModify: false, new: true });

		if (!document) {
			return next();
		}

		return res.status(200).send(document);
	} catch (err) {
		return next(err);
	}
};

module.exports = {
	update_document,
	update_documents
};
