'use strict';

const { UserSchema } = require('./../models/users.js');
const { getCollection } = require('./../db/mongoose.js');
const { errorResponse } = require('./../utils/errors.js');

const JWTauthenticate = async (req, res, next) => {
	try {
		const User = getCollection(req.params.database, 'Users', UserSchema);

		const token = req.header('x-auth');
		const user = await User.findByToken(token);
		if (!user) {
			return errorResponse(res, 401, 'Unauthorized');     
		}        
		req.user = user;
		req.token = token;
		return next();
	} catch (e) {
		return errorResponse(res, 401, 'Unauthorized'); 
	}
};

module.exports = { 
	JWTauthenticate
};
