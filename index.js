'use strict';

const immutable = require('object-path-immutable');
const _assign = require('lodash.assign');
const _get = require('lodash.get');
const _mapValues = require('lodash.mapvalues');
const _merge = require('lodash.merge');
const _omit = require('lodash.omit');

const MOUNT = '@@redux-mount-store/MOUNT';
const UNMOUNT = '@@redux-mount-store/UNMOUNT';
const QUERY = '@@redux-mount-store/QUERY';
const QUERY_RESULT = '@@redux-mount-store/QUERY_RESULT';

function createMountAction(path, initialState) {
	return {
		type: MOUNT,
		payload: {
			path,
			initialState
		}
	};
}

function createUnmountAction(path) {
	return {
		type: UNMOUNT,
		payload: {
			path
		}
	};
}

function createInitAction(path) {
	return {
		type: '@@redux/INIT',
		payload: {
			path
		}
	};
}

function createQueryResultAction(path, result) {
	return {
		type: QUERY_RESULT,
		payload: {
			path,
			result
		}
	};
}

/**
 * Given a view spec, convert all viewed paths indicated as strings to
 * functions.
 */
function normalizeViewedStateSpec(viewedStateSpec) {
	const normalizedViewedStateSpec = {};

	for (const key in viewedStateSpec) {
		let mapping = viewedStateSpec[key];

		normalizedViewedStateSpec[key] = typeof mapping === 'function' ?
			mapping :
			state => {
				const mappedState = _get(state, mapping);

				if (typeof mappedState === 'undefined') {
					const viewedDataError = new Error(
						`Could not resolve data from "${mapping}" for "${key}"`
					);
					viewedDataError.key = key;

					// :/
					viewedDataError.isReduxMountStoreError = true;

					throw viewedDataError;
				}

				return mappedState;
			};
	}

	return normalizedViewedStateSpec;
}

module.exports = createStore =>
	function createMountableStore(rootReducer, initialState, enhancer) {
		const mounts = {};
		let rootState = initialState;

		if (typeof enhancer !== 'undefined') {
			if (typeof enhancer !== 'function') {
				throw new Error('Expected the enhancer to be a function.');
			}

			return enhancer(createMountableStore)(rootReducer, initialState);
		}

		const reducer = (state, action) => {
			let newState = rootReducer(state, action);

			// update cached ownState of root store
			rootState = newState;

			// FIXME: this reducer will also be responsible for handling queries
			// Specifically, it should update the relevant viewedStateSpec

			// FIXME: update state *before* calling root reducer
			if (action.type === MOUNT) {
				// add the initial own state of the mounted store to the root store's
				// state
				newState = immutable.set(
					newState,
					action.payload.path,
					action.payload.initialState
				);

				// prime the cached state for the mounted store
				updateCachedState(
					action.payload.path,
					_get(newState, action.payload.path)
				);

				// bypass mounted reducers for this action
				return newState;
			} else if (action.type === UNMOUNT) {
				// remove the unmounted store's own state from the root store's state
				newState = immutable.del(newState, action.payload.path);

				mounts[action.payload.path] = undefined;
			} else if (action.type === QUERY_RESULT) {
				let mount = mounts[action.payload.path];
				let queriedStateSpec = _mapValues(
					action.payload.result,
					result => () => _get(rootState, result)
				);

				mount.viewedStateSpec =
					_assign({}, mount.viewedStateSpec, queriedStateSpec);
			}

			// FIXME: calculate this array at mount/unmount time
			// iterate over mounted reducers, breadth-first
			let paths = [];
			for (var path in mounts) {
				if (mounts.hasOwnProperty(path)) {
					paths.push(path.split('.'));
				}
			}
			paths = paths.sort(
				(pathA, pathB) => {
					return pathA.length - pathB.length;
				})
				.map(path => path.join('.'));

			function updateMountCache(path) {
				const mount = mounts[path];

				const ownState = _get(newState, path);
				const viewedState = getViewedState(path);

				if (ownState !== mount.cache.ownState ||
					viewedState !== mount.cache.viewedState
				) {
					// either the mount's own state or its viewed state have changed,
					// so recalculate its merged state
					updateCachedState(path, ownState);
				}
			}

			paths.forEach(path => {
				const mount = mounts[path];

				if (!mount.reducer) {
					// if `mount` has been called for a path, but the corresponding
					// mounted store creator *not* called, then no reducer will be
					// registered, so skip that path
					return;
				}

				updateMountCache(path);

				const newMergedState =
					mount.reducer.call(null, mount.cache.mergedState, action);

				if (newMergedState !== mount.cache.mergedState) {
					// FIXME: check that viewed state is not modified
					// FIXME: test that asserts that removed viewedState is reapplied
					mount.cache.mergedState =
						_merge(newMergedState, mount.cache.viewedState);
					mount.cache.ownState =
						_omit(newMergedState, Object.keys(mount.viewedStateSpec));
					newState = immutable.set(newState, path, mount.cache.ownState);
				}
			});

			// update cached state for all mounts
			paths.forEach(updateMountCache);

			return newState;
		};

		const store = createStore(reducer, initialState, enhancer);

		/*
		 * Calculate and return the viewed state for a mounted path
		 *
		 * This function calculates the viewed state for a mounted path. To do so,
		 * it starts with the currently cached viewed state if it exists, and then
		 * recalculates each value in the viewed state spec and compares it to the
		 * cached value. If different, it generates a new viewed state with the new
		 * value.
		 *
		 * When finished the new viewed state (or the cached viewed state if none of
		 * the viewed values have changed) is returned. The cached viewed state
		 * is *not* changed.
		 *
		 * @param {string} path - the mounted path to calculate viewed state for
		 *
		 * @returns {Object} the calculated viewed state
		 */
		function getViewedState(path) {
			const mount = mounts[path];
			const viewedStateSpec = mount.viewedStateSpec;
			const hostMergedState = mount.host === null ?
				rootState :
				mounts[mount.host].cache.mergedState;
			let viewedState = mount.cache.viewedState || {};

			for (let spec in viewedStateSpec) {
				let value = viewedStateSpec[spec](hostMergedState);
				if (viewedState[spec] !== value) {
					viewedState = immutable.set(viewedState, spec, value);
				}
			}

			return viewedState;
		}

		/*
		 * Update the cached state for a mounted path
		 *
		 * In order to ensure that calls to `getState` on a mounted store return
		 * results that are `===` to each other, we cache the own, viewed, and
		 * merged state for each mounted path.
		 *
		 * This function updates that cache if either the passed own state or the
		 * calculated viewed state do not match the cached values.
		 *
		 * @param {string} path - the mounted path to update
		 * @param {Object} ownState - the state object at the path in the root store
		 */
		function updateCachedState(path, ownState) {
			const mount = mounts[path];
			const viewedState = getViewedState(path);

			if (ownState !== mount.cache.ownState ||
				viewedState !== mount.cache.viewedState
			) {
				mount.cache.ownState = ownState;
				mount.cache.viewedState = viewedState;
				mount.cache.mergedState = _assign({}, ownState, viewedState);
			}
		}

		store.replaceReducer = nextReducer => {
			rootReducer = nextReducer;
			store.dispatch({type: '@@redux/INIT'});
		};

		store.dispatch = (dispatch => action => {
			if (action.type === QUERY) {
				if (!action.payload || typeof action.payload.path !== 'string') {
					throw new Error('QUERY actions must specify a string path');
				}

				if (!action.payload ||
					!action.payload.query ||
					typeof action.payload.query !== 'object'
				) {
					throw new Error('QUERY actions must specify a string query');
				}

				// If a query has gotten to here, then no other middleware answered it,
				// and we attempt to just map the queried paths straight out of the host
				// store. The reducer will do that when it sees a QUERY_RESULT, so just
				// turn this QUERY into a QUERY_RESULT.
				return dispatch(
					createQueryResultAction(
						action.payload.path,
						action.payload.query
					)
				);
			}

			return dispatch(action);
		})(store.dispatch);

		function mount(host, path, viewedStateSpec) {
			const mountPath = host === null ? path : `${host}.${path}`;

			if (typeof path !== 'string') {
				throw new Error(`Expected string path as first argument, got ${path}`);
			}

			viewedStateSpec = viewedStateSpec || {};
			if (typeof viewedStateSpec !== 'object') {
				// FIXME: line is too loooooong
				throw new Error(
					'Expected second argument to be omitted or viewed state spec ' +
					'argument, got ' + viewedStateSpec
				);
			}

			if (typeof mounts[mountPath] !== 'undefined') {
				// this mount is taken
				throw new Error(
					`Mount already exists at path "${path}" on "${host}"`
				);
			}

			// FIXME: we also need to check if path is in host's viewed state
			if (_get(store.getState(), mountPath)) {
				// there's existing state at the mount path
				throw new Error(
					`State exists at mount path "${path}" on "${host}"`
				);
			}

			mounts[mountPath] = {
				path,
				host: host,
				cache: {
					ownState: null,
					viewedState: null,
					mergedState: null
				},
				viewedStateSpec: normalizeViewedStateSpec(viewedStateSpec),
				reducer: null
			};

			// return mounted store creator with appropriate context, etc.
			let called = false;
			const createMountedStore =
				(mountReducer, mountInitialState, mountStoreEnhancer) => {
					if (called) {
						throw new Error(
							'This mounted store creator has already been called. Mounted ' +
							'store creators are single-use.'
						);
					}
					called = true;

					if (mountStoreEnhancer) {
						throw new Error('Mounted stores do not support store enhancers');
					}

					if (typeof mountReducer !== 'function') {
						throw new Error('Expected the reducer to be a function.');
					}

					mounts[mountPath].reducer = mountReducer;

					store.dispatch(createMountAction(mountPath, mountInitialState));
					store.dispatch(createInitAction(mountPath));

					// FIXME: all of these methods should check if the store is still
					// mounted and throw if not
					return {
						getState: () => mounts[mountPath].cache.mergedState,
						dispatch: action => {
							// FIXME: what should we do here? attach the mountPath to the
							// action?
							return store.dispatch(action);
						},
						replaceReducer: nextReducer => {
							mounts[mountPath].reducer = nextReducer;
							store.dispatch(createInitAction(mountPath));
						},
						subscribe: store.subscribe.bind(store),
						mount: mount.bind(null, mountPath),
						unmount: unmount.bind(null, mountPath),
						query: function (query) {
							this.dispatch({
								type: QUERY,
								payload: {
									path: mountPath,
									query
								}
							});
						}
					};
				};

			return createMountedStore;
		}

		store.mount = mount.bind(null, null);

		function isAncestor(path, possibleAncestor) {
			path = path.split('.');
			possibleAncestor = possibleAncestor.split('.');

			for (let i = 0; i < possibleAncestor.length; i++) {
				if (path[i] !== possibleAncestor[i]) {
					return false;
				}
			}

			return true;
		}

		function unmount(host, path) {
			path = host ? `${host}.${path}` : path;

			if (!mounts[path]) {
				throw new Error(`No such mount ${path}`);
			}

			const toUnmount = Array.from(Object.keys(mounts))
				.filter(key => {
					return isAncestor(key, path);
				})
				.sort((key1, key2) => {
					return key1.split('.').length < key2.split('.').length;
				});

			toUnmount.forEach(path => store.dispatch(createUnmountAction(path)));
		}

		store.unmount = unmount.bind(null, null);

		return store;
	};

module.exports.actionTypes = {
	MOUNT,
	UNMOUNT,
	QUERY,
	QUERY_RESULT
};
