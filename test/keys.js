'use strict'
var tape = require('tape');
var fs = require('fs');
var path = require('path');

function clearDatadir(opts) {
	try { fs.unlinkSync(path.join(opts.datadir, 'secret.name')); console.log('Deleted old keys'); } catch (e) {}
	try { rimraf.sync(path.join(opts.datadir, 'database')); console.log('Deleted old db'); } catch (e) {}
}

function b2h(arr) { return new Buffer(arr).toString('hex'); }

module.exports = function(opts) {
	tape('create', function(t) {
		var phoenixRpc = require('../');
		
		clearDatadir(opts);

		phoenixRpc.createServerOrConnect(opts, function(err, client, stream) {
			if (err) throw err;
			console.log('started at', client._port);

			client.createKeys(false, function(err, keys) {
				if (err) throw err;
				console.log('Created keys');
				console.log('Name', b2h(keys.name));
				console.log('Public', b2h(keys.public));
				t.assert(keys.exist);
				t.assert(!!keys.name);
				t.assert(!!keys.public);

				client.createKeys(true, function(err, keys) {
					if (err) throw err;
					console.log('Created keys 2');
					console.log('Name', b2h(keys.name));
					console.log('Public', b2h(keys.public));
					t.assert(keys.exist);
					t.assert(!!keys.name);
					t.assert(!!keys.public);

					client.createKeys(false, function(err, keys) {
						if (err) console.log('Didnt overwrite keys with force=false')
						t.assert(!!err);
						client.close();
						t.end();
					});
				});
			});
		});
	});

	tape('get', function(t) {
		var phoenixRpc = require('../');
		
		clearDatadir(opts);

		phoenixRpc.createServerOrConnect(opts, function(err, client, stream) {
			if (err) throw err;
			console.log('started at', client._port);

			client.createKeys(false, function(err, keys) {
				if (err) throw err;
				console.log('Created keys');
				console.log('Name', b2h(keys.name));
				console.log('Public', b2h(keys.public));
				t.assert(keys.exist);
				t.assert(!!keys.name);
				t.assert(!!keys.public);

				client.getKeys(function(err, keys2) {
					if (err) throw err;
					console.log('Got keys');
					console.log('Name', b2h(keys2.name));
					console.log('Public', b2h(keys2.public));
					t.assert(keys2.exist);
					t.assert(b2h(keys.name) == b2h(keys2.name));
					t.assert(b2h(keys.public) == b2h(keys2.public));

					client.close();
					t.end();
				});
			});
		});
	});
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data' });
