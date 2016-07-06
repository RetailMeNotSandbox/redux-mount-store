'use strict';

const immutable = require('object-path-immutable');
const tap = require('tap');
const isStoreEnhancer = require('./lib/helpers').isStoreEnhancer;
const isMountableStore = require('./lib/helpers').isMountableStore;
const implementsReduxStoreAPI =
	require('./lib/helpers').implementsReduxStoreAPI;
const redux = require('redux');
const reduxMountStore = require('../');
const sinon = require('sinon');

tap.test('redux-mount-store', t => {
	isStoreEnhancer(t, reduxMountStore);

	t.test('exports its action types as `actionTypes`', t => {
		t.same(reduxMountStore.actionTypes, {
			MOUNT: '@@redux-mount-store/MOUNT',
			UNMOUNT: '@@redux-mount-store/UNMOUNT',
			QUERY: '@@redux-mount-store/QUERY',
			QUERY_RESULT: '@@redux-mount-store/QUERY_RESULT'
		});

		t.end();
	});

	t.test('enhanced stores', t => {
		isMountableStore(
			t,
			redux.createStore(
				state => state,
				{},
				reduxMountStore
			),
			'are mountable stores'
		);

		implementsReduxStoreAPI(t, redux.createStore, reduxMountStore);

		t.test('reduction', t => {
			t.test('rootReducer called before mounted reducers', t => {
				const rootReducer = sinon.stub().returnsArg(0);
				const store = redux.createStore(
					rootReducer,
					{},
					reduxMountStore
				);

				const mountedReducer = sinon.stub().returnsArg(0);
				const mountedStore = store.mount('path')(mountedReducer);

				t.ok(
					rootReducer.calledBefore(mountedReducer),
					'root reducer called first during mount'
				);

				mountedReducer.reset();
				store.dispatch({type: 'JACKSON'});
				t.ok(
					rootReducer.calledBefore(mountedReducer),
					'root reducer called first for action dispatched from root store'
				);

				mountedReducer.reset();
				mountedStore.dispatch({type: 'JACKSON'});
				t.ok(
					rootReducer.calledBefore(mountedReducer),
					'root reducer called first for action dispatched from mounted store'
				);

				t.end();
			});

			t.test('ancestor mounted reducers called before descendants', t => {
				const store = redux.createStore(
					state => state,
					{},
					reduxMountStore
				);

				const hostReducer = sinon.stub().returnsArg(0);
				const hostStore = store.mount('host')(hostReducer);

				const childReducer = sinon.stub().returnsArg(0);
				const childStore = hostStore.mount('child')(childReducer);

				const grandChildReducer = sinon.stub().returnsArg(0);
				const grandChildStore =
					childStore.mount('grandChild')(grandChildReducer);

				t.ok(
					hostReducer.calledBefore(childReducer) &&
					childReducer.calledBefore(grandChildReducer),
					'reducers called in order during mount'
				);

				hostReducer.reset();
				childReducer.reset();
				grandChildReducer.reset();
				store.dispatch({type: 'JACKSON'});
				t.ok(
					hostReducer.calledBefore(childReducer) &&
					childReducer.calledBefore(grandChildReducer),
					'reducers called in order for action dispatched from root store'
				);

				hostReducer.reset();
				childReducer.reset();
				grandChildReducer.reset();
				hostStore.dispatch({type: 'JACKSON'});
				t.ok(
					hostReducer.calledBefore(childReducer) &&
					childReducer.calledBefore(grandChildReducer),
					'reducers called in order for action dispatched from eldest store'
				);

				hostReducer.reset();
				childReducer.reset();
				grandChildReducer.reset();
				childStore.dispatch({type: 'JACKSON'});
				t.ok(
					hostReducer.calledBefore(childReducer) &&
					childReducer.calledBefore(grandChildReducer),
					'reducers called in order for action dispatched from middle store'
				);

				hostReducer.reset();
				childReducer.reset();
				grandChildReducer.reset();
				grandChildStore.dispatch({type: 'JACKSON'});
				t.ok(
					hostReducer.calledBefore(childReducer) &&
					childReducer.calledBefore(grandChildReducer),
					'reducers called in order for action dispatched from youngest store'
				);

				t.end();
			});

			t.test(
				'descendant reducers observe changes to the sources of their viewed ' +
				'state made by their ancestors',
				t => {
					const store = redux.createStore(
						(state, action) => {
							if (action.type === 'MUTATE_ROOT') {
								state = immutable.set(state, 'rootOwn', 'new root');
							}

							return state;
						},
						{
							rootOwn: 'root'
						},
						reduxMountStore
					);

					const hostReducer = sinon.spy((state, action) => {
						if (action.type === 'MUTATE_HOST') {
							state = immutable.set(state, 'hostOwn', 'new host');
						}

						return state;
					});
					const hostStore =
						store.mount('host', {
							rootViewed: 'rootOwn'
						})(
							hostReducer,
							{
								hostOwn: 'host'
							}
						);

					const childReducer = sinon.spy(state => state);
					const childStore =
						hostStore.mount('child', {
							hostViewed: 'hostOwn'
						})(
							childReducer,
							{
								childOwn: 'child'
							}
						);

					hostReducer.reset();
					childReducer.reset();
					childStore.dispatch({
						type: 'MUTATE_ROOT'
					});

					t.same(hostReducer.firstCall.args[0], {
						rootViewed: 'new root',
						hostOwn: 'host',
						child: {
							childOwn: 'child'
						}
					});

					t.same(childReducer.firstCall.args[0], {
						hostViewed: 'host',
						childOwn: 'child'
					});

					hostReducer.reset();
					childReducer.reset();
					childStore.dispatch({
						type: 'MUTATE_HOST'
					});

					t.same(hostReducer.firstCall.args[0], {
						rootViewed: 'new root',
						hostOwn: 'host',
						child: {
							childOwn: 'child'
						}
					});

					t.same(childReducer.firstCall.args[0], {
						hostViewed: 'new host',
						childOwn: 'child'
					});

					t.end();
				});

			t.test('mounted reducers called with a null context', t => {
				const store = redux.createStore(
					state => state,
					{},
					reduxMountStore
				);

				const mountedReducer = sinon.stub().returnsArg(0);
				const mountedStore = store.mount('some.cool.path')(mountedReducer);

				t.ok(
					mountedReducer.calledOnce &&
					mountedReducer.firstCall.thisValue === null,
					'mounted reducer called with null context during mount'
				);

				mountedReducer.reset();
				store.dispatch({type: 'JACKSON'});
				t.ok(
					mountedReducer.calledOnce &&
					mountedReducer.firstCall.thisValue === null,
					'mounted reducer called with null context for action dispatched ' +
					'from root store'
				);

				mountedReducer.reset();
				mountedStore.dispatch({type: 'JACKSON'});
				t.ok(
					mountedReducer.calledOnce &&
					mountedReducer.firstCall.thisValue === null,
					'mounted reducer called with null context for action dispatched ' +
					'from mounted store'
				);

				t.end();
			});

			t.test('mount paths without reducers are skipped', t => {
				const store = redux.createStore(
					state => state,
					{},
					reduxMountStore
				);

				store.mount('some.path');

				t.doesNotThrow(() => {
					store.dispatch({type: 'TESTING'});
				});

				t.end();
			});

			// FIXME: invalid viewed state spec tests
			//
			// - string that references non-existant state
			// - function that throws an error
			// - need tests for reduction and getState

			t.end();
		});

		t.end();
	});

	t.end();
});
