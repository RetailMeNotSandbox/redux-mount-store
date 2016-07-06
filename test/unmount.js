'use strict';

const tap = require('tap');
const sinon = require('sinon');
const redux = require('redux');

const reduxMountStore = require('../');
const UNMOUNT = reduxMountStore.actionTypes.UNMOUNT;

tap.test('unmount()', t => {
	t.test('args', t => {
		t.test('throws if passed anything other than a valid mount path', t => {
			const store = redux.createStore(state => state, {}, reduxMountStore);

			store.mount('some.path');

			[
				'some',
				'some.path.lol',
				'another.path',
				'',
				null,
				undefined,
				0,
				123,
				[],
				{},
				true,
				false
			].forEach(path => {
				t.throws(() => {
					store.unmount(path);
				}, `should throw on invalid path '${path}'`);
			});

			t.end();
		});

		t.end();
	});

	t.test('dispatches an UNMOUNT action', t => {
		t.test('for the path in question, relative to the host', t => {
			const store = redux.createStore(state => state, {}, reduxMountStore);
			const path = 'some.path';

			store.mount(path);
			sinon.stub(store, 'dispatch');
			store.unmount(path);

			t.ok(store.dispatch.calledOnce, 'dispatch called once');
			t.same(
				store.dispatch.firstCall.args[0],
				{
					type: UNMOUNT,
					payload: {
						path
					}
				},
				'dispatch passed an UNMOUNT action for the path'
			);

			const hostStore = store.mount('host')(state => state, {});
			sinon.stub(hostStore, 'dispatch');
			hostStore.mount('child');

			store.dispatch.reset();
			hostStore.unmount('child');

			t.ok(store.dispatch.calledOnce, 'dispatch called once');
			t.same(
				store.dispatch.firstCall.args[0],
				{
					type: UNMOUNT,
					payload: {
						path: 'host.child'
					}
				},
				'dispatch passed an UNMOUNT action for the path relative to the host'
			);

			t.end();
		});

		t.test('for stores mounted on the path in question', t => {
			const store = redux.createStore(state => state, {}, reduxMountStore);
			const path = 'some.path';
			const childPath = 'another.path';

			const mountedStore = store.mount(path)(
				state => state,
				{}
			);
			mountedStore.mount(childPath);

			sinon.stub(store, 'dispatch');
			store.unmount(path);

			t.ok(store.dispatch.calledWithMatch({
				type: UNMOUNT,
				payload: {
					path: `${path}.${childPath}`
				}
			}), 'UNMOUNT action dispatched for child path');

			t.end();
		});

		t.test('descendant stores are unmounted before ancestor stores', t => {
			const store = redux.createStore(
				state => state,
				{},
				reduxMountStore
			);

			const hostStore = store.mount('host')(
				state => state
			);

			const childStore = hostStore.mount('child')(
				state => state
			);

			childStore.mount('grandChild')(
				state => state
			);

			sinon.stub(store, 'dispatch');
			store.unmount('host');

			t.ok(store.dispatch.firstCall.calledWithMatch({
				type: UNMOUNT,
				payload: {
					path: 'host.child.grandChild'
				}
			}), 'UNMOUNT action dispatched for grandchild first');

			t.ok(store.dispatch.secondCall.calledWithMatch({
				type: UNMOUNT,
				payload: {
					path: 'host.child'
				}
			}), 'UNMOUNT action dispatched for child second');

			t.ok(store.dispatch.thirdCall.calledWithMatch({
				type: UNMOUNT,
				payload: {
					path: 'host'
				}
			}), 'UNMOUNT action dispatched for host last');

			t.end();
		});

		t.end();
	});

	t.test('does not dispatch an UNMOUNT action for unrelated paths', t => {
		const store = redux.createStore(state => state, {}, reduxMountStore);
		const path = 'some.path';
		const unrelatedPath = 'another.path';

		store.mount(path);
		store.mount(unrelatedPath);

		sinon.stub(store, 'dispatch');
		store.unmount(path);

		t.ok(store.dispatch.neverCalledWithMatch({
			payload: {
				path: unrelatedPath
			}
		}), 'UNMOUNT action not dispatched for unrelated path');

		t.end();
	});

	t.test('reduction', t => {
		const rootReducer = sinon.stub().returnsArg(0);
		const store = redux.createStore(rootReducer, {}, reduxMountStore);
		const path = 'some.path';
		const unrelatedPath = 'another.path';

		const unmountedReducer = sinon.spy(state => {
			return state;
		});
		store.mount(path)(unmountedReducer);
		const unrelatedReducer = sinon.stub().returnsArg(0);
		store.mount(unrelatedPath)(unrelatedReducer);

		rootReducer.reset();
		unmountedReducer.reset();
		unrelatedReducer.reset();
		store.unmount(path);

		t.ok(rootReducer.calledWithMatch({}, {
			type: UNMOUNT,
			payload: {
				path: path
			}
		}), 'root reducer called with UNMOUNT action');

		t.ok(
			!unmountedReducer.called,
			'unmounted reducer not called with UNMOUNT action'
		);

		t.ok(unrelatedReducer.calledWithMatch({}, {
			type: UNMOUNT,
			payload: {
				path: path
			}
		}), 'unrelated reducer called with UNMOUNT action');

		store.dispatch({type: 'TESTING'});
		t.ok(
			!unmountedReducer.called,
			'unmounted reducer not called for other actions'
		);

		t.end();
	});

	t.test('unmounted paths are available for mounting', t => {
		const store = redux.createStore(state => state, {}, reduxMountStore);
		const path = 'some.path';
		const anotherPath = 'another.path';

		store.mount(path);
		store.unmount(path);
		t.doesNotThrow(() => {
			store.mount(path);
		});

		store.mount(anotherPath)(state => state);
		store.unmount(anotherPath);
		t.doesNotThrow(() => {
			store.mount(anotherPath);
		});

		t.end();
	});

	t.test('unmounted paths are removed from the host store\'s own state', t => {
		const store = redux.createStore(state => state, {}, reduxMountStore);

		const hostStore = store.mount('host')(
			state => state
		);
		hostStore.mount('child')(
			state => state
		);

		hostStore.unmount('child');
		t.same(
			hostStore.getState(),
			{},
			'child mount path removed from host mounted store merged state'
		);
		t.same(store.getState(), {
			host: {}
		}, 'child mount path removed from root store own state');

		store.unmount('host');
		t.same(
			store.getState(),
			{},
			'mount path removed from root store own state'
		);

		t.end();
	});

	t.end();
});
