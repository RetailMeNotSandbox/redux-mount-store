# redux-mount-store

Store enhancer for redux adding mounting capabilities

## Gist

Mount to a slice of the state and define data to view from that state. Receive
a store creator. That store, when created, will receive the viewed data in its
reducer and via `getState()`.

```
const withMounts = require('@rmn/redux-mount-store');
const redux = require('redux');

const mountableStore = redux.createStore(
  (state, action) => state,
	{
		todos: [
			{
				description: 'Pet a dog',
				done: true
			},
			{
				description: 'Pet a frog',
				done: false
			}
		]
	},
	withMounts
);

const createMountedStore = mountableStore.mount(
  // the key in the mountable store where any non-virtual data will be stored
	'someComponent',
  // define a mapping from the mountable store's state to the mounted store's
  // virtual (or "viewed") state
	{
		completedTodos: state => state.todos.filter(todo => todo.done)
	}
);

// same signature as `createStore()`
const mountedStore = createMountedStore(
  // this reducer receives the virtual state and its own state merged together.
  // mutations to any virtual state will throw an error
	(state, action) => state,

  // the mounted store's own initial state. this will be persisted to the "real"
  // store.
	{
		isDropdownVisible: false
	}
);
```

Let's call `getState()` on each store. The state that we see is the same state
provided to each store's reducer.

```
console.log(mountableStore.getState());

// note that a slice of the mountable store is created for the mounted store,
// containing its initial state. note that it does NOT contain the virtual
// state, which is instead provided to the mounted store's reducer and when its
// `getState()` method is called.
// { todos:
//    [ { description: 'Pet a dog', done: true },
//      { description: 'Pet a frog', done: false } ],
//   someComponent: { isDropdownVisible: false } }

console.log(mountedStore.getState());

// the mounted store sees its full state as well as its virtual/viewed state.
// in this case, it can update `isDropdownVisible` in its own reducer and that
// change will be visible in both stores. however, attempts to update
// completedTodos will raise an Error
// { isDropdownVisible: false,
//   completedTodos: [ { description: 'Pet a dog', done: true } ] }
```

## Why?

In certain cases, this can be easier than simply mapping the store's state to
the shape expected by consumers. Additionally, abstracting the layer at which
the "real" store exists allows it to be plugged it any layer.

## Consuming the redux-mount-store package

There are two ways of consuming `@retailmenot/redux-mount-store` within your
application.

By default, when you `require('@retailmenot/redux-mount-store')`. You get the redux-
mount-store source code, which is written using ES6 features such as fat arrow
functions.

redux-mount-store also publishes an ES5 compatible version of itself to the
`dist/` directory, which can be consumed by applications that are using webpack
without babel by aliasing `@retailmenot/redux-mount-store` to the transpiled
code. In your webpack config:

```javascript
resolve: {
    alias: {
        '@retailmenot/redux-mount-store': path.join(
            path.dirname(
                require.resolve('@retailmenot/redux-mount-store')
            ), 'dist/index.js'
        )
    }
}
```

The downside to this approach is that sourcemaps in your consuming application
will point to the transpiled code instead of the redux-mount-store source.
