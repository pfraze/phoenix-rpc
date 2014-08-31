'use strict'
var tape = require('tape');
var fs = require('fs');
var path = require('path');

function clearKeyfile(opts) {
	try {
		fs.unlinkSync(path.join(opts.datadir, 'secret.name'));
		console.log('Deleted old keys');
	} catch (e) {}
}

module.exports = function(opts) {
	tape('create', function(t) {
		var phoenixRpc = require('../');
		
		clearKeyfile(opts);

		phoenixRpc.createServerOrConnect(opts, function(err, client, stream) {
			if (err) throw err;
			console.log('started at', client._port);

			client.createKeys(false, function(err, keys) {
				if (err) throw err;
				console.log('Created keys');
				console.log('Name', keys.name);
				console.log('Public', keys.public);
				t.assert(keys.exist);
				t.assert(!!keys.name);
				t.assert(!!keys.public);

				client.createKeys(true, function(err, keys) {
					if (err) throw err;
					console.log('Created keys 2');
					console.log('Name', keys.name);
					console.log('Public', keys.public);
					t.assert(keys.exist);
					t.assert(!!keys.name);
					t.assert(!!keys.public);

					client.createKeys(false, function(err, keys) {
						if (err) console.log('Didnt overwrite keys with force=false')
						t.assert(!!err);
						client._server.cleanup();
						client._server.close();
						stream.end();
						t.end();
					});
				});
			});
		});
	});

	tape('get', function(t) {
		var phoenixRpc = require('../');
		
		clearKeyfile(opts);

		phoenixRpc.createServerOrConnect(opts, function(err, client, stream) {
			if (err) throw err;
			console.log('started at', client._port);

			client.createKeys(false, function(err, keys) {
				if (err) throw err;
				console.log('Created keys');
				console.log('Name', keys.name);
				console.log('Public', keys.public);
				t.assert(keys.exist);
				t.assert(!!keys.name);
				t.assert(!!keys.public);

				client.getKeys(function(err, keys2) {
					if (err) throw err;
					console.log('Got keys');
					console.log('Name', keys2.name);
					console.log('Public', keys2.public);
					t.assert(keys2.exist);
					t.assert(keys.name == keys2.name);
					t.assert(keys.public == keys2.public);

					client._server.cleanup();
					client._server.close();
					stream.end();
					t.end();
				});
			});
		});
	});
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data' });
