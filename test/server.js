'use strict'
var tape = require('tape');
var debug = require('../lib/debug');
debug.logging.mx = true;

function clearDatadir(opts) {
	try { fs.unlinkSync(path.join(opts.datadir, 'secret.name')); console.log('Deleted old keys'); } catch (e) {}
	try { rimraf.sync(path.join(opts.datadir, 'database')); console.log('Deleted old db'); } catch (e) {}
	try { fs.unlinkSync(path.join(opts.datadir, 'phoenix-rpc.port')); console.log('Deleted old portfile (if it existed)'); } catch (e) {}
}

module.exports = function(opts) {
	clearDatadir(opts);
	
	tape('1 instance', function(t) {
		var phoenixRpc = require('../');
		phoenixRpc.createServerOrConnect(opts, function(err, client1, stream1) {
			if (err) throw err;
			console.log('started at', client1._port);

			var nCalls = 0;
			function pong(x) {
				return function(err, y) {
					t.equal(x + 1, y);
					nCalls++;
					if (nCalls == 3) {
						client1._server.close();
						client1._server.cleanup();
						stream1.end();
						t.end();
					}
				}
			}

			client1.ping(1, pong(1));
			client1.ping(2, pong(2));
			client1.ping(3, pong(3));
		});
	});

	tape('2 instances', function(t) {
		var phoenixRpc = require('../');
		phoenixRpc.createServerOrConnect(opts, function(err, client1, stream1) {
			if (err) throw err;
			console.log('started at', client1._port);

			phoenixRpc.createServerOrConnect(opts, function(err, client2, stream2) {
				if (err) throw err;
				console.log('connected at', client2._port);

				var nCalls = 0;
				function pong(x) {
					return function(err, y) {
						t.equal(x + 1, y);
						nCalls++;
						if (nCalls == 6) {
							client1._server.close();
							client1._server.cleanup();
							stream1.end();
							stream2.end();
							t.end();
						}
					}
				}

				t.equal(client1._port, client2._port);
				client1.ping(1, pong(1));
				client2.ping(4, pong(4));
				client1.ping(2, pong(2));
				client2.ping(5, pong(5));
				client1.ping(3, pong(3));
				client2.ping(6, pong(6));
			});
		});
	});

	tape('substreams', function(t) {
		var phoenixRpc = require('../');
		phoenixRpc.createServerOrConnect(opts, function(err, client1, stream1) {
			if (err) throw err;
			console.log('started at', client1._port);

			var a = 5, b = 10;
			var psa = client1.pingStream(a);
			var psb = client1.pingStream(b);
			psa.on('data', function(chunk) { t.equal(a, +chunk); a++; });
			psb.on('data', function(chunk) { t.equal(b, +chunk); b++; });

			var ends = 0;
			psa.on('end', onEnd);
			psb.on('end', onEnd);
			function onEnd() {
				if (++ends !== 2) return;
				t.equal(8, a);
				t.equal(13, b);
				client1._server.close();
				client1._server.cleanup();
				stream1.end();
				t.end();
			}
		});
	});
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data' });
