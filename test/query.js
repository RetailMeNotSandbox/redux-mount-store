'use strict';

const tap = require('tap');
const sinon = require('sinon');
const redux = require('redux');
const _get = require('lodash.get');
const immutable = require('object-path-immutable');

const reduxMountStore = require('../');
const QUERY = reduxMountStore.actionTypes.QUERY;
const QUERY_RESULT = reduxMountStore.actionTypes.QUERY_RESULT;

tap.test('queried state', t => {
	t.test('@@redux-mount-store/QUERY', t => {
		t.test('shape', t => {
			const store = redux.createStore(state => state, {}, reduxMountStore);

			t.throws(() => {
				store.dispatch({
					type: QUERY,
					payload: {
						query: {}
					}
				});
			}, '`payload.path` is required');

			t.throws(() => {
				store.dispatch({
					type: QUERY,
					payload: {
						path: 123,
						query: {}
					}
				});
			}, '`payload.path` must be a string');

			t.throws(() => {
				store.dispatch({
					type: QUERY,
					payload: {
						path: 'foo'
					}
				});
			}, '`payload.query` is required');

			t.throws(() => {
				store.dispatch({
					type: QUERY,
					payload: {
						query: 123,
						path: 'foo'
					}
				});
			}, '`payload.query` must be an object');

			t.end();
		});

		t.test('dispatch', t => {
			const initialState = {
				care: {
					bears: {
						care: true,
						stare: true,
						call: false
					},
					friends: {
						care: true,
						stare: false,
						call: true
					}
				}
			};
			const reducer = sinon.spy(state => state);
			const store =
				redux.createStore(reducer, initialState, reduxMountStore);
			store.mount('some.path');

			reducer.reset();
			store.dispatch({
				type: QUERY,
				payload: {
					path: 'some.path',
					query: {
						bearsCare: 'care.bears.care',
						friendsCall: 'care.friends.call'
					}
				}
			});

			t.ok(reducer.calledOnce, 'reducer called once for action');
			t.ok(reducer.calledWithMatch(initialState, {
				type: QUERY_RESULT,
				payload: {
					path: 'some.path',
					result: {
						bearsCare: 'care.bears.care',
						friendsCall: 'care.friends.call'
					}
				}
			}), 'QUERY_RESULT action reduced with correct state');

			t.end();
		});

		t.end();
	});

	t.test('@@redux-mount-store/QUERY_RESULT', t => {
		t.test('reduction', t => {
			const initialState = {
				care: {
					bears: {
						care: true,
						stare: true,
						call: false
					},
					friends: {
						care: true,
						stare: false,
						call: true
					}
				}
			};
			const reducer = sinon.spy(
				(state, action) => {
					if (action.type === 'STOP_CARING_LIFE_IS_MEANINGLESS') {
						return immutable.set(state, 'care.bears.care', false);
					}

					return state;
				}
			);
			const store =
				redux.createStore(reducer, initialState, reduxMountStore);
			const childReducer = sinon.spy(state => state);
			const childStore = store.mount('some.path')(childReducer);

			reducer.reset();
			childReducer.reset();
			store.dispatch({
				type: QUERY,
				payload: {
					path: 'some.path',
					query: {
						bearsCare: 'care.bears.care',
						friendsCall: 'care.friends.call'
					}
				}
			});

			t.ok(childReducer.calledOnce, 'reducer called once for action');
			t.same(
				childReducer.firstCall.args[0],
				{
					bearsCare: _get(initialState, 'care.bears.care'),
					friendsCall: _get(initialState, 'care.friends.call'),
				},
				'child reducer sees newly mapped viewed state'
			);
			t.same(
				childReducer.firstCall.args[1],
				{
					type: QUERY_RESULT,
					payload: {
						path: 'some.path',
						result: {
							bearsCare: 'care.bears.care',
							friendsCall: 'care.friends.call'
						}
					}
				},
				'child reducer sees QUERY_RESULT action'
			);

			store.dispatch({
				type: 'STOP_CARING_LIFE_IS_MEANINGLESS'
			});

			// bears don't care about anything, have you ever even seen a bear?
			t.equal(childStore.getState().bearsCare, false,
				'when queried state is updated in host, it should be seen in child'
			);

			t.end();
		});

		t.end();
	});

	t.end();
});
