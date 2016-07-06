'use strict';

const tap = require('tap');
const sinon = require('sinon');
const redux = require('redux');
const _merge = require('lodash.merge');
const immutable = require('object-path-immutable');

const isStoreCreator = require('./lib/helpers').isStoreCreator;
const isMountableStore = require('./lib/helpers').isMountableStore;
const implementsReduxStoreAPI =
	require('./lib/helpers').implementsReduxStoreAPI;

const reduxMountStore = require('../');
const QUERY = reduxMountStore.actionTypes.QUERY;

tap.test('mount()', t => {
	t.test('args', t => {
		t.test('throws if mount exists at mount path', t => {
			const store = redux.createStore(state => state, {}, reduxMountStore);

			store.mount('some.path');

			t.throws(() => {
				store.mount('some.path');
			});

			t.end();
		});

		t.test('throws if state exists at mount path', t => {
			const store = redux.createStore(state => state, {
				some: {
					path: {
					}
				}
			}, reduxMountStore);

			t.throws(() => {
				store.mount('some.path');
			});

			t.end();
		});

		t.end();
	});

	t.test('return value', t => {
		const initialState = {
			animal: {
				raccoon: {
					isCute: true,
					isTerrifying: true
				}
			}
		};
		const rootReducer = sinon.stub().returnsArg(0);
		const mountableStore = redux.createStore(
			rootReducer,
			initialState,
			reduxMountStore
		);

		const mountedStoreCreator = mountableStore.mount(
			'animal.ringtail',
			{
				isCute: 'animal.raccoon.isCute',
				isTerrifying: state => !state.animal.raccoon.isTerrifying
			}
		);

		isStoreCreator(t, mountedStoreCreator, 'is a store creator');

		t.test('throws if called more than once', t => {
			const store = redux.createStore(state => state, {}, reduxMountStore);

			const mountedStoreCreator = store.mount('some.path');

			mountedStoreCreator(state => state, {});

			t.throws(() => {
				mountedStoreCreator(state => state, {});
			});

			t.end();
		});

		t.test('throws if not passed a function as the reducer', t => {
			const store = redux.createStore(state => state, {}, reduxMountStore);

			const mountedStoreCreator = store.mount('some.path');

			t.throws(() => {
				mountedStoreCreator('lol', {});
			});

			t.end();
		});

		t.test('throws if passed a store enhancer', t => {
			const store = redux.createStore(state => state, {}, reduxMountStore);

			const mountedStoreCreator = store.mount('some.path');

			t.throws(() => {
				mountedStoreCreator(state => state, {}, () => 'lol');
			});

			t.end();
		});

		isMountableStore(
			t,
			redux.createStore(state => state, {}, reduxMountStore)
				.mount('some.path')(state => state, {}),
			'creates a mountable store'
		);

		t.end();
	});

	t.test('mounted stores', t => {
		const initialState = {
			animal: {
				raccoon: {
					isCute: true,
					isTerrifying: true
				}
			}
		};
		const rootReducer = sinon.stub().returnsArg(0);
		const mountableStore = redux.createStore(
			rootReducer,
			initialState,
			reduxMountStore
		);

		const mountedStoreCreator = mountableStore.mount(
			'animal.ringtail',
			{
				isCute: 'animal.raccoon.isCute',
				isTerrifying: state => !state.animal.raccoon.isTerrifying
			}
		);
		const mountedInitialState = {
			name: 'jerry'
		};
		const mountedReducer = sinon.stub().returnsArg(0);
		const mountedStore = mountedStoreCreator(
			mountedReducer,
			mountedInitialState
		);

		let hostState = mountableStore.getState();
		const viewedInitialState = mountedStore.getState();
		t.same(
			viewedInitialState,
			_merge({}, mountedInitialState, {
				isCute: hostState.animal.raccoon.isCute,
				isTerrifying: !hostState.animal.raccoon.isTerrifying
			}),
			'getState returns object containing initial state and viewed state'
		);

		t.equal(
			mountedStore.getState(),
			viewedInitialState,
			'getState returns the same state object between reductions'
		);

		mountedReducer.reset();
		const action = {
			type: 'WE_WERE_NOT_MEANT_TO_BE'
		};
		mountableStore.dispatch(action);

		t.equal(
			mountedReducer.firstCall.args[0],
			viewedInitialState,
			'if viewed state has not changed, reducers get the same object as ' +
				'returned by `getState()`.'
		);

		implementsReduxStoreAPI(
			t,
			(reducer, initialState, storeEnhancer) => {
				const store = redux.createStore(
					state => state,
					{},
					reduxMountStore
				);

				return store.mount('some.path')(reducer, initialState);
			}
		);

		t.test('throw if viewed state refers to non-existent state', t => {
			const store = redux.createStore(state => state, {}, reduxMountStore);

			const createStore = store.mount('some.path', {
				foo: 'bar'
			});

			t.throws(() => {
				createStore(state => state, {});
			});

			t.end();
		});

		t.test('viewed state', t => {
			t.test('is calculated from the host merged state', t => {
				const store = redux.createStore(
					(state, action) => {
						if (action.type === 'MUTATE_ROOT') {
							return immutable.set(state, 'rootOwn', 'rootnew');
						}

						return state;
					},
					{
						rootOwn: 'root'
					},
					reduxMountStore
				);

				const hostStore =
					store.mount('host', {
						hostViewed: 'rootOwn'
					})(
						(state, action) => {
							if (action.type === 'MUTATE_HOST') {
								return immutable.set(state, 'hostOwn', 'hostnew');
							}

							return state;
						},
						{
							hostOwn: 'host'
						}
					);

				const childStore =
					hostStore.mount('child', {
						hostViewed: 'hostViewed',
						hostOwn: 'hostOwn'
					})(
						state => state,
						{
							childOwn: 'child'
						}
					);

				t.same(childStore.getState(), {
					hostViewed: 'root',
					hostOwn: 'host',
					childOwn: 'child'
				});

				childStore.dispatch({
					type: 'MUTATE_ROOT'
				});

				t.same(childStore.getState(), {
					hostViewed: 'rootnew',
					hostOwn: 'host',
					childOwn: 'child'
				});

				childStore.dispatch({
					type: 'MUTATE_HOST'
				});

				t.same(childStore.getState(), {
					hostViewed: 'rootnew',
					hostOwn: 'hostnew',
					childOwn: 'child'
				});

				t.end();
			});

			t.test('is not visible from other stores', t => {
				const store = redux.createStore(
					state => state,
					{},
					reduxMountStore
				);

				const hostStore = store.mount('host')(
					state => state,
					{
						foo: 'bar'
					}
				);

				hostStore.mount('child', {
					foo: 'foo'
				})(
					state => state,
					{
						fiz: 'biz'
					}
				);

				t.notMatch(
					store.getState(),
					{
						host: {
							child: {
								foo: 'foo'
							}
						}
					},
					'root store should not see viewed state of child'
				);

				t.notMatch(
					hostStore.getState(),
					{
						child: {
							foo: 'foo'
						}
					},
					'host mounted store should not see viewed state of child'
				);

				t.end();
			});

			t.end();
		});

		t.test('dispatch');

		t.test('implement a `query` method', t => {
			const store = redux.createStore(
				state => state,
				{},
				reduxMountStore
			);

			const childStore = store.mount('child')(
				state => state,
				{
					foo: 'bar'
				}
			);

			t.type(childStore.query, 'function');

			const dispatchSpy = sinon.spy(childStore, 'dispatch');

			const query = {
				fiz: 'biz',
				frob: 'nard.card.ward'
			};
			childStore.query(query);

			t.ok(dispatchSpy.calledWithMatch({
				type: QUERY,
				payload: {
					path: 'child',
					query
				}
			}), 'dispatches a QUERY action with the passed query');

			t.end();
		});

		t.end();
	});

	t.end();
});
