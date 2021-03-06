'use strict'
var tape = require('tape');
var debug = require('../lib/debug');
debug.logging.mx = true;

function clearDatadir(opts) {
	try { fs.unlinkSync(path.join(opts.datadir, 'secret.name')); console.log('Deleted old keys'); } catch (e) {}
	try { rimraf.sync(path.join(opts.datadir, 'database')); console.log('Deleted old db'); } catch (e) {}
}

module.exports = function(opts) {
	clearDatadir(opts);
	
	tape('1 instance', function(t) {
		var phoenixRpc = require('../');
		var server1 = phoenixRpc.server(opts);
		var client1 = phoenixRpc.client();
		client1.pipe(server1).pipe(client1);

		var nCalls = 0;
		function pong(x) {
			return function(err, y) {
				t.equal(x + 1, y);
				nCalls++;
				if (nCalls == 3) {
					client1.end();
					server1.end();
					t.end();
				}
			}
		}

		client1.api.ping(1, pong(1));
		client1.api.ping(2, pong(2));
		client1.api.ping(3, pong(3));
	});

	tape('2 instances', function(t) {
		var phoenixRpc = require('../');
		var server1 = phoenixRpc.server(opts);
		var server2 = phoenixRpc.server(opts);
		var client1 = phoenixRpc.client();
		var client2 = phoenixRpc.client();
		client1.pipe(server1).pipe(client1);
		client2.pipe(server2).pipe(client2);

		var nCalls = 0;
		function pong(x) {
			return function(err, y) {
				t.equal(x + 1, y);
				nCalls++;
				if (nCalls == 6) {
					client1.end();
					client2.end();
					server1.end();
					server2.end();
					t.end();
				}
			}
		}

		client1.api.ping(1, pong(1));
		client2.api.ping(4, pong(4));
		client1.api.ping(2, pong(2));
		client2.api.ping(5, pong(5));
		client1.api.ping(3, pong(3));
		client2.api.ping(6, pong(6));
	});

	tape('substreams', function(t) {
		var phoenixRpc = require('../');
		var server = phoenixRpc.server(opts);
		var client1 = phoenixRpc.client();
		client1.pipe(server).pipe(client1);

		var a = 5, b = 10;
		var psa = client1.api.pingStream(a);
		var psb = client1.api.pingStream(b);
		psa.on('data', function(chunk) { t.equal(a, +chunk); a++; });
		psb.on('data', function(chunk) { t.equal(b, +chunk); b++; });

		var ends = 0;
		psa.on('end', onEnd);
		psb.on('end', onEnd);
		function onEnd() {
			if (++ends !== 2) return;
			t.equal(8, a);
			t.equal(13, b);
			client1.end();
			server.end();
			t.end();
		}
	});

	tape('proxy', function(t) {
		var phoenixRpc = require('../');
		var server = phoenixRpc.server(opts);
		var client1 = phoenixRpc.client();
		client1.pipe(server).pipe(client1);

		var proxy = phoenixRpc.proxy(client1.api, ['ping', 'pingStream'])
		var client2 = phoenixRpc.client();
		client2.pipe(proxy).pipe(client2);

		console.log('pinging proxy with 1')
		client2.api.ping(1, function(err, x) {
			if (err) throw err

			console.log('ponged', x)
			t.equal(x, 2)

			console.log('pingstreaming proxy with', x)
			client2.api.pingStream(x)
				.on('data', function(chunk) { t.equal(x++, +chunk); console.log('pongstreamed', chunk) })
				.on('end', function() {
					console.log('getKeys on proxy (not allowed)')
					client2.api.getKeys(function(err, keys) {
						console.log(err, keys)
						t.assert(!!err)
						console.log('createFeedStream on proxy (not allowed)')
						var stream = client2.api.createFeedStream()
						stream.on('error', function(err) {
							console.log(err)
							t.assert(!!err)
							t.end()
						})
						stream.on('end', function() {
							console.log('createFeedStream emitted data when it should have failed')
							t.assert(false)
						})
					})
				})
		});
	});
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data' });
