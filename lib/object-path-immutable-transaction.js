'use strict';
const _assign = require('lodash.assign');
const objectPath = require('object-path');
const _isArray = require('lodash.isarray');
const _isPlainObject = require('lodash.isplainobject');

function ensureCloned(path, source, dest) {
	if (!_isArray(path)) {
		path = ('' + path).split('.');
	}

	// ensure all ancestor path segments are cloned
	for (let i = 0; i < path.length; i++) {
		if (dest[path[i]] === source[path[i]]) {
			if (_isArray(source[path[i]])) {
				dest[path[i]] = source[path[i]].slice();
			} else {
				dest[path[i]] = _assign({}, source[path[i]]);
			}
		}

		source = source[path[i]];
		dest = dest[path[i]];
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
			if (arguments.length < 2) {
				return;
			}

			path = !_isArray(path) ? path.split('.') : path;

			ensureCloned(path.slice(0, -1), source, result);
			objectPath.set(result, path, value);

			return transaction;
		},

		del: function del(path) {
			if (arguments.length < 1) {
				return;
			}

			path = !_isArray(path) ? path.split('.') : path;

			ensureCloned(path.slice(0, -1), source, result);
			objectPath.del(result, path);

			return transaction;
		},

		push: function push(path, value) {
			if (arguments.length < 2) {
				return;
			}

			ensureCloned(path, source, result);
			objectPath.push(result, path, value);

			return transaction;
		},

		assign: function assign(path, value) {
			if (arguments.length < 2) {
				return;
			}

			path = !_isArray(path) ? path.split('.') : path;

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
