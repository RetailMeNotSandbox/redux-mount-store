'use strict';

const tap = require('tap');
const sinon = require('sinon');
const immutableTransaction =
	require('../lib/object-path-immutable-transaction');

tap.test('object-path-immutable-transaction', t => {
	t.type(immutableTransaction, 'function', 'exports a function');
	t.throws(() => immutableTransaction(), 'requires an argument');

	t.test('return value', t => {
		t.type(immutableTransaction({}), 'object', 'object');
		t.type(immutableTransaction({}).set, 'function', 'implements `set`');
		t.type(immutableTransaction({}).del, 'function', 'implements `del`');
		t.type(immutableTransaction({}).push, 'function', 'implements `push`');
		t.type(immutableTransaction({}).assign, 'function', 'implements `assign`');

		t.end();
	});

	t.test('set', t => {
		t.test('does nothing if not passed enough arguments', t => {
			const source = {
				foo: {
					bar: {
						applesauce: 'chutney'
					}
				},
				fiz: ['buzz']
			};
			const transaction = immutableTransaction(source);

			t.doesNotThrow(() => transaction.set());
			t.doesNotThrow(() => transaction.set('foo.bar'));
			t.same(transaction.commit(), source);

			t.end();
		});

		t.test('sets the passed value at the specified path', t => {
			const transaction = immutableTransaction({
				foo: {
					bar: {
						applesauce: 'chutney'
					}
				},
				fiz: ['buzz']
			});

			transaction.set('foo.bar.applesauce', 'jam');
			transaction.set('foo.baz', []);
			transaction.set('foo.baz.0', 'zero');
			transaction.set('fiz.0', 'biz');
			transaction.set('frob', 'nard');

			const result = transaction.commit();
			t.same(
				result,
				{
					foo: {
						bar: {
							applesauce: 'jam'
						},
						baz: ['zero']
					},
					fiz: ['biz'],
					frob: 'nard'
				}
			);
			t.type(result.fiz, 'Array', 'arrays are cloned correctly');

			t.end();
		});

		t.test('also accepts the path as an array', t => {
			const transaction = immutableTransaction({
				foo: {
					bar: {
						applesauce: 'chutney'
					}
				}
			});

			transaction.set(['foo', 'bar', 'applesauce'], 'jam');

			const result = transaction.commit();
			t.same(
				result,
				{
					foo: {
						bar: {
							applesauce: 'jam'
						}
					}
				}
			);

			t.end();
		});

		t.test('ensures that all members of the path are cloned', t => {
			const source = {
				foo: {
					bar: {
						applesauce: 'chutney'
					}
				},
				fiz: ['buzz']
			};
			const transaction = immutableTransaction(source);

			transaction.set('foo.bar.applesauce', 'jam');
			transaction.set('fiz.0', 'biz');

			const result = transaction.commit();
			t.notStrictEqual(result.foo, source.foo);
			t.notStrictEqual(result.foo.bar, source.foo.bar);
			t.notStrictEqual(result.fiz, source.fiz);
			t.notStrictEqual(result.fiz[0], source.fiz[0]);

			t.end();
		});

		t.test('unaffected paths are not cloned', t => {
			const source = {
				foo: {
					bar: {
						applesauce: 'chutney',
						unaffected: {}
					},
					unaffected: {}
				},
				unaffected: {}
			};
			const transaction = immutableTransaction(source);

			transaction.set('foo.bar.applesauce', 'jam');

			const result = transaction.commit();
			t.strictEqual(result.unaffected, source.unaffected);
			t.strictEqual(result.foo.unaffected, source.foo.unaffected);
			t.strictEqual(result.foo.bar.unaffected, source.foo.bar.unaffected);

			t.end();
		});

		t.test('is chainable', t => {
			const transaction = immutableTransaction({});

			t.strictEqual(
				transaction.set('foo', 'bar'),
				transaction,
				'returns the transaction'
			);

			t.end();
		});

		t.end();
	});

	t.test('del', t => {
		t.test('does nothing if not passed enough arguments', t => {
			const source = {
				foo: {
					bar: {
						applesauce: 'chutney'
					}
				},
				fiz: ['buzz']
			};
			const transaction = immutableTransaction(source);

			t.doesNotThrow(() => transaction.del());
			t.same(transaction.commit(), source);

			t.end();
		});

		t.test('deletes the value at the specified path', t => {
			const transaction = immutableTransaction({
				foo: {
					bar: {
						applesauce: 'chutney'
					},
					baz: {
						quux: 'lol'
					}
				},
				fiz: ['buzz', 'biz']
			});

			transaction.del('foo.bar.applesauce');
			transaction.del('foo.baz');
			transaction.del('fiz.0');

			const result = transaction.commit();
			t.same(
				result,
				{
					foo: {
						bar: {
						}
					},
					fiz: ['biz']
				}
			);
			t.type(result.fiz, 'Array', 'arrays are cloned correctly');

			t.end();
		});

		t.test('also accepts the path as an array', t => {
			const transaction = immutableTransaction({
				foo: {
					bar: {
						applesauce: 'chutney'
					}
				}
			});

			transaction.del(['foo', 'bar', 'applesauce']);

			const result = transaction.commit();
			t.same(
				result,
				{
					foo: {
						bar: {
						}
					}
				}
			);

			t.end();
		});

		t.test('ensures that all members of the path are cloned', t => {
			const source = {
				foo: {
					bar: {
						applesauce: 'chutney'
					}
				},
				fiz: ['buzz']
			};
			const transaction = immutableTransaction(source);

			transaction.del('foo.bar.applesauce');
			transaction.del('fiz.0');

			const result = transaction.commit();
			t.notStrictEqual(result.foo, source.foo);
			t.notStrictEqual(result.foo.bar, source.foo.bar);
			t.notStrictEqual(result.fiz, source.fiz);

			t.end();
		});

		t.test('unaffected paths are not cloned', t => {
			const source = {
				foo: {
					bar: {
						applesauce: 'chutney',
						unaffected: {}
					},
					unaffected: {}
				},
				unaffected: {}
			};
			const transaction = immutableTransaction(source);

			transaction.del('foo.bar.applesauce');

			const result = transaction.commit();
			t.strictEqual(result.unaffected, source.unaffected);
			t.strictEqual(result.foo.unaffected, source.foo.unaffected);
			t.strictEqual(result.foo.bar.unaffected, source.foo.bar.unaffected);

			t.end();
		});

		t.test('is chainable', t => {
			const transaction = immutableTransaction({
				foo: 'bar'
			});

			t.strictEqual(
				transaction.del('foo'),
				transaction,
				'returns the transaction'
			);

			t.end();
		});

		t.end();
	});

	t.test('push', t => {
		t.test('does nothing if not passed enough arguments', t => {
			const source = {
				foo: {
					bar: {
						applesauce: 'chutney'
					}
				},
				fiz: ['buzz']
			};
			const transaction = immutableTransaction(source);

			t.doesNotThrow(() => transaction.push());
			t.doesNotThrow(() => transaction.push('fiz'));
			t.same(transaction.commit(), source);

			t.end();
		});

		t.test('pushes the value onto the array at the specified path', t => {
			const transaction = immutableTransaction({
				foo: {
					bar: {
						applesauce: ['chutney']
					}
				},
				fiz: ['buzz']
			});

			transaction.push('foo.bar.applesauce', 'jam');
			transaction.push('fiz', 'biz');

			const result = transaction.commit();
			t.same(
				result,
				{
					foo: {
						bar: {
							applesauce: ['chutney', 'jam']
						}
					},
					fiz: ['buzz', 'biz']
				}
			);
			t.type(result.foo.bar.applesauce, 'Array', 'arrays are cloned correctly');
			t.type(result.fiz, 'Array', 'arrays are cloned correctly');

			t.end();
		});

		t.test('also accepts the path as an array', t => {
			const transaction = immutableTransaction({
				foo: {
					bar: {
						applesauce: ['chutney']
					}
				}
			});

			transaction.push(['foo', 'bar', 'applesauce'], 'jam');

			const result = transaction.commit();
			t.same(
				result,
				{
					foo: {
						bar: {
							applesauce: ['chutney', 'jam']
						}
					}
				}
			);

			t.end();
		});

		t.test('ensures that all members of the path are cloned', t => {
			const source = {
				foo: {
					bar: {
						applesauce: ['chutney']
					}
				},
				fiz: ['buzz']
			};
			const transaction = immutableTransaction(source);

			transaction.push('foo.bar.applesauce', 'jam');
			transaction.push('fiz', 'biz');

			const result = transaction.commit();
			t.notStrictEqual(result.foo, source.foo);
			t.notStrictEqual(result.foo.bar, source.foo.bar);
			t.notStrictEqual(result.fiz, source.fiz);

			t.end();
		});

		t.test('unaffected paths are not cloned', t => {
			const source = {
				foo: {
					bar: {
						applesauce: ['chutney'],
						unaffected: {}
					},
					unaffected: {}
				},
				unaffected: {}
			};
			const transaction = immutableTransaction(source);

			transaction.push('foo.bar.applesauce', 'jam');

			const result = transaction.commit();
			t.strictEqual(result.unaffected, source.unaffected);
			t.strictEqual(result.foo.unaffected, source.foo.unaffected);
			t.strictEqual(result.foo.bar.unaffected, source.foo.bar.unaffected);

			t.end();
		});

		t.test('is chainable', t => {
			const transaction = immutableTransaction({
				foo: []
			});

			t.strictEqual(
				transaction.push('foo', 'bar'),
				transaction,
				'returns the transaction'
			);

			t.end();
		});

		t.end();
	});

	t.test('assign', t => {
		let transaction = immutableTransaction({
			foo: {
				bar: {
					applesauce: ['chutney']
				}
			},
			fiz: ['buzz']
		});

		sinon.spy(transaction, 'set');

		let toAssign = {
			bar: 'applesauce',
			baz: {
				frob: ['nard']
			}
		};
		transaction.assign('foo', toAssign);

		t.strictEqual(
			transaction.set.callCount,
			2,
			'set called once for each own property of passed object'
		);
		t.ok(
			transaction.set.calledWithExactly(['foo', 'bar'], toAssign.bar),
			'set called with own property key and value'
		);
		t.ok(
			transaction.set.calledWithExactly(['foo', 'baz'], toAssign.baz),
			'set called with own property key and value'
		);

		transaction.set.reset();
		toAssign = {
			fiz: 'buzz',
			fuzz: 'biz'
		};
		transaction.assign('foo.baz', toAssign);
		t.strictEqual(
			transaction.set.callCount,
			2,
			'set called once for each own property of passed object'
		);
		t.ok(
			transaction.set.calledWithExactly(['foo', 'baz', 'fiz'], toAssign.fiz),
			'set called with own property key and value'
		);
		t.ok(
			transaction.set.calledWithExactly(['foo', 'baz', 'fuzz'], toAssign.fuzz),
			'set called with own property key and value'
		);

		transaction.set.reset();
		toAssign = {
			fiz: 'buzz'
		};
		transaction.assign(['foo', 'baz'], toAssign);
		t.strictEqual(
			transaction.set.callCount,
			1,
			'path can also be an array'
		);
		t.ok(
			transaction.set.calledWithExactly(['foo', 'baz', 'fiz'], toAssign.fiz),
			'path can also be an array'
		);

		transaction.set.reset();
		toAssign = Object.create({
			fiz: 'buzz'
		});
		transaction.assign('foo.baz', toAssign);
		t.strictEqual(
			transaction.set.callCount,
			0,
			'set not called for inherited properties'
		);


		t.test('does nothing if not passed enough arguments', t => {
			const source = {
				foo: {
					bar: {
						applesauce: 'chutney'
					}
				},
				fiz: ['buzz']
			};
			const transaction = immutableTransaction(source);

			t.doesNotThrow(() => transaction.assign());
			t.doesNotThrow(() => transaction.assign('foo.bar'));
			t.same(transaction.commit(), source);

			t.end();
		});

		t.test('unaffected paths are not cloned', t => {
			const source = {
				foo: {
					bar: {
						applesauce: 'chutney',
						unaffected: {}
					},
					unaffected: {}
				},
				unaffected: {}
			};
			const transaction = immutableTransaction(source);

			transaction.assign('foo.bar', {
				applesauce: 'jam'
			});

			const result = transaction.commit();
			t.strictEqual(result.unaffected, source.unaffected);
			t.strictEqual(result.foo.unaffected, source.foo.unaffected);
			t.strictEqual(result.foo.bar.unaffected, source.foo.bar.unaffected);

			t.end();
		});

		t.test('is chainable', t => {
			const transaction = immutableTransaction({
				foo: null
			});

			t.strictEqual(
				transaction.assign('foo', {}),
				transaction,
				'returns the transaction'
			);

			t.end();
		});

		t.end();
	});

	t.end();
});
