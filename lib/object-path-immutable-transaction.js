'use strict';

const _assign = require('lodash.assign');
const objectPath = require('object-path');
const _isPlainObject = require('lodash.isplainobject');

function normalizePath(path) {
	return Array.isArray(path) ? path : ('' + path).split('.');
}

/**
 * Ensure all parts of a path in a destination object are cloned from its source
 *
 * This function expects a path expressed as a dot-delimited string or an array
 * of strings, as well as a source object and a destination object. It then
 * ensures that the value at each part of the path in the destination is !== to
 * the value at the same part of the path in the source. If any values are ===,
 * it clones the value in the destination.
 *
 * All values in the source are assumed to be either an array or a plain object.
 *
 * @param {string|Array} path - the path to check
 * @param {Object} source - the source object
 * @param {Object} dest - the destination object
 */
function ensureCloned(path, source, dest) {
	path = normalizePath(path);

	// ensure all ancestor path segments are cloned by starting from the root of
	// the path and cloning any that have the same value in source and destination
	for (let i = 0; i < path.length; i++) {
		let key = path[i];

		if (dest[key] === source[key]) {
			// the destination value is identical to the source value, so clone it
			if (Array.isArray(source[key])) {
				dest[key] = source[key].slice();
			} else {
				dest[key] = _assign({}, source[key]);
			}
		}

		source = source[key];
		dest = dest[key];
	}
}

function createTransaction(source) {
	if (!_isPlainObject(source)) {
		throw new Error('Source must be a plain object. Got ' + source);
	}

	const result = _assign({}, source);
	let committed = false;

	const transaction = {
		set: function set(path, value) {
			if (committed) {
				throw new Error('Cannot call `set` on a committed transaction');
			}

			if (arguments.length < 2) {
				return;
			}

			path = normalizePath(path);

			ensureCloned(path.slice(0, -1), source, result);
			objectPath.set(result, path, value);

			return transaction;
		},

		del: function del(path) {
			if (committed) {
				throw new Error('Cannot call `del` on a committed transaction');
			}

			if (arguments.length < 1) {
				return;
			}

			path = normalizePath(path);

			ensureCloned(path.slice(0, -1), source, result);
			objectPath.del(result, path);

			return transaction;
		},

		push: function push(path, value) {
			if (committed) {
				throw new Error('Cannot call `push` on a committed transaction');
			}

			if (arguments.length < 2) {
				return;
			}

			ensureCloned(path, source, result);
			objectPath.push(result, path, value);

			return transaction;
		},

		assign: function assign(path, value) {
			if (committed) {
				throw new Error('Cannot call `assign` on a committed transaction');
			}

			if (arguments.length < 2) {
				return;
			}

			path = normalizePath(path);

			for (var k in value) {
				if (value.hasOwnProperty(k)) {
					this.set(path.concat(k), value[k]);
				}
			}

			return transaction;
		},

		commit: () => {
			committed = true;
			return result
		}
	};

	return transaction;
}

module.exports = createTransaction;
