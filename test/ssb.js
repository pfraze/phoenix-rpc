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

function b2h(buff) { return buff.toString('hex'); }
function b2s(buff) { return buff.toString('utf8'); }
function bsum (value) {
	return new Blake2s().update(value).digest()
}


module.exports = function(opts, opts2) {
	clearDatadir(opts);
	clearDatadir(opts2);
	var phoenixRpc = require('../');
	var _keys;

	tape('create feed', function(t) {
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);

		var server2 = phoenixRpc.server(opts2);
		var client2 = phoenixRpc.client();
		client2.pipe(server2).pipe(client2);

		client.api.createKeys(true, function(err, keys) {
			if (err) throw err;
			console.log('Created keys');
			console.log('Name', b2h(keys.name));
			console.log('Public', b2h(keys.public));
			t.assert(keys.exist);
			t.assert(!!keys.name);
			t.assert(!!keys.public);
			_keys = keys;

			client2.api.createKeys(true, function(err) {
				if (err) throw err;
				console.log('created second keys')

				client2.api.follow(new Buffer(keys.name), function(err) {
					if (err) throw err;
					console.log('keypair2 now following keypar1');
					t.end();
				});
			});
		});
	});

	tape('add messages, read feed stream', function(t) {
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);

		var calls = 0;
		client.api.addMessage('text', 'message 1', handleAddMsg);
		client.api.addMessage('text', 'message 2', handleAddMsg);
		client.api.addMessage('text', 'message 3', handleAddMsg);
		function handleAddMsg(err) {
			if (err) throw err;
			console.log('added message', calls+1);
			if (++calls < 3) return;

			console.log('reading feed');
			calls = 0;
			client.api.createFeedStream()
				.on('data', function(msg) {
					++calls;
					t.equal(calls, +msg.sequence);
					t.equal(b2h(_keys.name), b2h(msg.author));
					if (calls > 1)
						console.log(msg.sequence, b2s(msg.message));
				})
				.on('end', function() {
					t.equal(4, calls);
					t.end();
				});
		}
	});

	tape('get public key', function(t) {
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);

		client.api.getPublicKey(_keys.name, function(err, pubkey) {
			if (err) throw err

			t.equal(b2h(_keys.public), b2h(pubkey))
			t.end()
		})
	})

	tape('follow, following, unfollow', function(t) {
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);

		var calls = 0;
		var otherkeys = ecc.restore(k256, crypto.randomBytes(32))
		var other = bsum(otherkeys.public).toString('hex');
		client.api.follow(other, function(err) {
			if (err) throw err;

			console.log('followed', other);
			var n = 0;
			var f = client.api.following();
			f.on('data', function(entry) {
				var name = b2h(entry.key);
				console.log('following', name);
				if (other == name || b2h(_keys.name) == name)
					n++
			})
			f.on('end', function() {
				if (n !== 2)
					throw "not following everybody that's expected";
				client.api.unfollow(other, function(err) {
					if (err) throw err;
					
					console.log('unfollowed', other);
					var f = client.api.following()
					f.on('data', function(entry) {
						t.assert(other !== b2h(entry.key));
					})
					f.on('end', function() {
						t.end();
					});
				})
			})
		});
	});

	tape('createLogStream', function(t) {
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);

		var calls = 0;
		var ls = client.api.createLogStream()
		ls.on('data', function(entry) {
			var v = entry.value;
			if (v.sequence == 1)
				t.equal('init', b2s(v.type));
			else if (v.sequence <= 4)
				t.equal('text', b2s(v.type));
			console.log(b2s(v.type), b2s(v.message));
		});
		ls.on('end', function() {
			t.end();
		});
	});

	tape('createHistoryStream', function(t) {
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);

		var calls = 0;
		var ls = client.api.createHistoryStream(_keys.public)
		ls.on('data', function(entry) {
			var v = entry.value;
			if (v.sequence == 1)
				t.equal('init', b2s(v.type));
			else if (v.sequence <= 4)
				t.equal('text', b2s(v.type));
			console.log(b2s(v.type), b2s(v.message));
		});
		ls.on('end', function() {
			t.end();
		});
	});

	tape('createReplicationStream', function(t) {
		var server1 = phoenixRpc.server(opts);
		var client1 = phoenixRpc.client();
		client1.pipe(server1).pipe(client1);

		var server2 = phoenixRpc.server(opts2);
		var client2 = phoenixRpc.client();
		client2.pipe(server2).pipe(client2);

		var rpl1 = client1.api.createReplicationStream();
		var rpl2 = client2.api.createReplicationStream();
		rpl1.on('data', function(data) { console.log('rpl1', b2h(data)); });
		rpl2.on('data', function(data) { console.log('rpl2', b2h(data)); });
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
							t.deepEqual(feeds[0], feeds[1]);
							t.end();
						}
					}
					pull(toPull(client1.api.createFeedStream()), pull.collect(next));
			        pull(toPull(client2.api.createFeedStream()), pull.collect(next));
			    }, 300); // wait 300ms because the repl-stream 'end' doesnt tell us when our server has finished processing
			}
		}
	});
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data', port: 64050 }, { datadir: __dirname + '/.data2', port: 64051 });
