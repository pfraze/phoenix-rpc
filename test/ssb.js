'use strict'
var tape = require('tape');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var crypto   = require('crypto');
var ecc      = require('eccjs');
var k256     = ecc.curves.k256;
var Blake2s  = require('blake2s');
var pull = require('pull-stream')
var toPull = require('stream-to-pull-stream')
var debug = require('../lib/debug');
debug.logging.mx = true;

function clearDatadir(opts) {
	try { fs.unlinkSync(path.join(opts.datadir, 'secret.name')); console.log('Deleted old keys'); } catch (e) {}
	try { rimraf.sync(path.join(opts.datadir, 'database')); console.log('Deleted old db'); } catch (e) {}
}

function a2b2h(arr) { return new Buffer(arr).toString('hex'); }
function a2b2s(arr) { return new Buffer(arr).toString('utf8'); }
function bsum (value) {
	return new Blake2s().update(value).digest()
}


module.exports = function(opts, opts2) {
	clearDatadir(opts);
	clearDatadir(opts2);
	var phoenixRpc = require('../');
	var _keys;

	tape('create feed', function(t) {
		phoenixRpc.createServerOrConnect(opts, function(err, client, stream) {
			if (err) throw err;
			console.log('started at', client._port);

			client.createKeys(true, function(err, keys) {
				if (err) throw err;
				console.log('Created keys');
				console.log('Name', a2b2h(keys.name));
				console.log('Public', a2b2h(keys.public));
				t.assert(keys.exist);
				t.assert(!!keys.name);
				t.assert(!!keys.public);
				_keys = keys;

				// go ahead and create second keypair now too
				phoenixRpc.createServerOrConnect(opts2, function(err, client2, stream2) {
					if (err) throw err;
					console.log('started 2 at', client2._port);

					client2.createKeys(true, function(err) {
						if (err) throw err;
						console.log('created second keys')

						client2.follow(new Buffer(keys.name), function(err) {
							if (err) throw err;
							console.log('keypair2 now following keypar1');

							client.close();
							client2.close();
							t.end();
						});
					});
				});
			});
		});
	});

	tape('add messages, read feed stream', function(t) {
		phoenixRpc.createServerOrConnect(opts, function(err, client, stream) {
			if (err) throw err;
			console.log('started at', client._port);

			var calls = 0;
			client.addMessage('text', 'message 1', handleAddMsg);
			client.addMessage('text', 'message 2', handleAddMsg);
			client.addMessage('text', 'message 3', handleAddMsg);
			function handleAddMsg(err) {
				if (err) throw err;
				console.log('added message', calls+1);
				if (++calls < 3) return;

				console.log('reading feed');
				calls = 0;
				client.createFeedStream()
					.on('data', function(msg) {
						++calls;
						t.equal(calls, +msg.sequence);
						t.equal(a2b2h(_keys.name), a2b2h(msg.author));
						if (calls > 1)
							console.log(msg.sequence, a2b2s(msg.message));
					})
					.on('end', function() {
						t.equal(4, calls);

						client.close();
						t.end();
					});
			}
		});
	});

	tape('follow, following, unfollow', function(t) {
		phoenixRpc.createServerOrConnect(opts, function(err, client, stream) {
			if (err) throw err;
			console.log('started at', client._port);

			var calls = 0;
    		var otherkeys = ecc.restore(k256, crypto.randomBytes(32))
    		var other = bsum(otherkeys.public).toString('hex');
			client.follow(other, function(err) {
				if (err) throw err;

				console.log('followed', other);
				var n = 0;
				var f = client.following();
				f.on('data', function(entry) {
					var name = a2b2h(entry.key);
					console.log('following', name);
					if (other == name || a2b2h(_keys.name) == name)
						n++
				})
				f.on('end', function() {
					if (n !== 2)
						throw "not following everybody that's expected";
					client.unfollow(other, function(err) {
						if (err) throw err;
						
						console.log('unfollowed', other);
						var f = client.following()
						f.on('data', function(entry) {
							t.assert(other !== a2b2h(entry.key));
						})
						f.on('end', function() {
							client.close();
							t.end();
						});
					})
				})
			});
		});
	});

	tape('createLogStream', function(t) {
		phoenixRpc.createServerOrConnect(opts, function(err, client, stream) {
			if (err) throw err;
			console.log('started at', client._port);

			var calls = 0;
			var ls = client.createLogStream()
			ls.on('data', function(entry) {
				var v = entry.value;
				if (v.sequence == 1)
					t.equal('init', a2b2s(v.type));
				else if (v.sequence <= 4)
					t.equal('text', a2b2s(v.type));
				console.log(a2b2s(v.type), a2b2s(v.message));
			});
			ls.on('end', function() {
				client.close();
				t.end();
			});
		});
	});

	tape('createReplicationStream', function(t) {
		phoenixRpc.createServerOrConnect(opts, function(err, client1, stream1) {
			if (err) throw err;
			console.log('started 1 at', client1._port);

			phoenixRpc.createServerOrConnect(opts2, function(err, client2, stream2) {
				if (err) throw err;
				console.log('started 2 at', client2._port);

				var rpl1 = client1.createReplicationStream();
				var rpl2 = client2.createReplicationStream();
				rpl1.on('data', function(data) { console.log('rpl1', a2b2h(data)); });
				rpl2.on('data', function(data) { console.log('rpl2', a2b2h(data)); });
				rpl1.pipe(rpl2).pipe(rpl1);

				rpl1.on('end', onEnd);
				rpl2.on('end', onEnd);
				var calls = 0;
				function onEnd() {
					console.log('end');
					if (++calls == 2) {
						setTimeout(function() {
							var feeds = [];
							var next = function(err, feed) {
								if (err) throw err;
								feeds.push(feed);
								if (feeds.length == 2) {
									t.deepEqual(feeds[0], feeds[1])
									client1.close();
									client2.close();
									t.end();
								}
							}
							pull(toPull(client1.createFeedStream()), pull.collect(next));
					        pull(toPull(client2.createFeedStream()), pull.collect(next));
					    }, 300); // wait 300ms because the repl-stream 'end' doesnt tell us when our server has finished processing
					}
				}
			});
		});
	});
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data', port: 64050 }, { datadir: __dirname + '/.data2', port: 64051 });
