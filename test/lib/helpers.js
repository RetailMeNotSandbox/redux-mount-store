'use strict';

const redux = require('redux');
const sinon = require('sinon');
const immutable = require('object-path-immutable');

function isStoreEnhancer(t, fn, message) {
	message = message || 'is a store enhancer';

	t.test(message, t => {
		let createStoreCalled = false;
		const createStore = (reducer, initialState, storeEnhancer) => {
			createStoreCalled = true;

			const store = redux.createStore(reducer, initialState, storeEnhancer);
			sinon.spy(store, 'getState');
			sinon.spy(store, 'subscribe');
			sinon.spy(store, 'dispatch');
			sinon.spy(store, 'replaceReducer');

			return store;
		};

		const enhancedCreateStore = fn(createStore);
		enhancedCreateStore(state => state, {});

		t.type(fn, 'function', 'is a function');
		t.equal(fn.length, 1, 'takes one argument');
		isStoreCreator(t, enhancedCreateStore, 'returns a store creator');
		t.ok(createStoreCalled, 'when invoked, calls passed store creator');

		t.test('accepts an optional store enhancer', t => {
			const expected = {};
			const createStore = sinon.stub();
			const enhancedCreateStore = sinon.stub().returns(expected);
			const storeEnhancer = sinon.stub().returns(enhancedCreateStore);

			const storeCreator = fn(createStore);
			const reducer = state => state;
			const initialState = {};
			storeCreator(reducer, initialState, storeEnhancer);

			t.ok(storeEnhancer.calledOnce, 'store enhancer called');
			t.type(
				storeEnhancer.firstCall.args[0],
				'function',
				'store enhancer passed a function'
			);
			t.ok(
				enhancedCreateStore.calledWithExactly(reducer, initialState),
				'store enhancer\'s return value called with reducer and inital state'
			);

			t.throws(
				() => {
					storeCreator(state => state, {}, 'lol');
				},
				'throws if passed something other than a function'
			);

			t.end();
		});

		t.end();
	});
}

function isStoreCreator(t, fn, message) {
	message = message || 'is a store creator';

	t.test(message, (t) => {
		t.type(fn, 'function', 'is a function');
		t.equal(fn.length, 3, 'takes three arguments');
		isStore(t, fn(state => state, {}), 'returns a store');

		t.end();
	});
}

function isStore(t, store, message) {
	message = message || 'is a store';

	t.test(message, (t) => {
		t.type(store.getState, 'function', 'has a getState method');
		t.type(store.dispatch, 'function', 'has a dispatch method');
		t.type(store.subscribe, 'function', 'has a subscribe method');
		t.type(store.replaceReducer, 'function', 'has a replaceReducer method');

		t.end();
	});
}

function isMountableStore(t, store, message) {
	message = message || 'is a mountable store';

	t.test(message, (t) => {
		isStore(t, store);
		t.type(store.mount, 'function', 'has a mount method');
		t.equal(store.mount.length, 2, 'takes two arguments');

		[
			undefined,
			null,
			0,
			1,
			{},
			[],
			true,
			false
		].forEach((arg) => {
			t.throws(
					() => store.mount(arg),
					`requires a string mount path as its first argument, not ${arg}`
				);
		});

		[
			1,
			true,
			'lol'
		].forEach((arg, index) => {
			t.throws(
					() => store.mount('path' + index, arg),
					'accepts an optional view spec object as its second argument, not ' +
						arg
				);
		});

		t.end();
	});
}

function implementsReduxStoreAPI(t, createStore, storeEnhancer, message) {
	message = message || 'implements redux store API';

	t.test(message, t => {
		const initialState = {
			bears: {
				care: true,
				stare: false
			}
		};
		let returnValue = null;
		const reducer = sinon.spy(function (state, action) {
			if (returnValue === null) {
				return state;
			}

			return returnValue;
		});
		let store;

		t.beforeEach(done => {
			returnValue = null;
			reducer.reset();
			store = createStore(reducer, initialState, storeEnhancer);
			done();
		});

		t.test('initialization', t => {
			t.ok(reducer.called, 'reducer called');

			t.same(
				reducer.firstCall.args[0],
				initialState,
				'reducer called with an object that looks like initial state'
			);

			t.match(
				reducer.firstCall.args[1],
				{type: '@@redux/INIT'},
				'action was @@redux/INIT'
			);

			t.same(
				store.getState(),
				initialState,
				'getState returns an object that looks like initial state'
			);

			t.end();
		});

		t.test('dispatch', t => {
			const action = {
				type: 'STARE',
				payload: '<3<3<3'
			};
			const newState = immutable.set(initialState, 'bears.stare', true);

			reducer.reset();
			returnValue = newState;
			store.dispatch(action);

			t.ok(reducer.calledOnce, 'reducer called when action dispatched');

			t.same(
				reducer.firstCall.args[0],
				initialState,
				'reducer called with an object that looks like initial state'
			);

			t.strictEqual(
				reducer.firstCall.args[1],
				action,
				'reducer called with dispatched action'
			);

			t.strictEqual(
				store.getState(),
				newState,
				'getState returns new state'
			);

			t.end();
		});

		t.test('subscribe', t => {
			const action = {
				type: 'STARE',
				payload: '<3<3<3'
			};
			const subscriber = sinon.stub();
			const unsubscribe = store.subscribe(subscriber);

			reducer.reset();
			store.dispatch(action);

			t.ok(subscriber.calledOnce, 'subscriber called');
			t.ok(
				subscriber.calledAfter(reducer),
				'subscriber called after action reduced'
			);

			subscriber.reset();
			unsubscribe();
			store.dispatch(action);

			t.ok(!subscriber.called, 'unsubscribed subscriber not called');

			t.end();
		});

		t.test('replaceReducer', t => {
			const newState = immutable.set(initialState, 'cousins', {
				care: 'true',
				call: 'false'
			});
			const newReducer = sinon.stub().returns(newState);

			reducer.reset();
			store.replaceReducer(newReducer);

			t.ok(!reducer.called, 'old reducer not called');
			t.ok(newReducer.calledOnce, 'new reducer called once');
			t.same(
				newReducer.firstCall.args[0],
				initialState,
				'new reducer called with an object that looks like initial state'
			);
			t.match(
				newReducer.firstCall.args[1],
				{type: '@@redux/INIT'},
				'action was @@redux/INIT'
			);

			t.strictEqual(
				store.getState(),
				newState,
				'getState returns new state'
			);

			newReducer.reset();
			const action = {
				type: 'STARE',
				payload: '<3<3<3'
			};
			const newerState = immutable(newState)
				.set('bears.stare', true)
				.set('cousins.call', true)
				.value();
			newReducer.returns(newerState);
			store.dispatch(action);

			t.ok(!reducer.called, 'old reducer not called');
			t.ok(newReducer.calledOnce, 'new reducer called once');
			t.ok(
				newReducer.calledWithExactly(newState, action),
				'reducer called with previous state and action'
			);

			t.strictEqual(
				store.getState(),
				newerState,
				'getState returns newer state'
			);

			t.end();
		});

		t.end();
	});
}

module.exports = {
	isStore,
	isMountableStore,
	isStoreCreator,
	isStoreEnhancer,
	implementsReduxStoreAPI
};
