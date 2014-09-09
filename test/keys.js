'use strict'
var tape = require('tape');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');

function clearDatadir(opts) {
	try { fs.unlinkSync(path.join(opts.datadir, 'secret.name')); console.log('Deleted old keys'); } catch (e) {}
	try { rimraf.sync(path.join(opts.datadir, 'database')); console.log('Deleted old db'); } catch (e) {}
}

function b2h(buff) { return buff.toString('hex'); }

module.exports = function(opts) {
	tape('create', function(t) {
		clearDatadir(opts);
		var phoenixRpc = require('../');
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);

		client.api.createKeys(false, function(err, keys) {
			if (err) throw err;
			console.log('Created keys');
			console.log('Name', b2h(keys.name));
			console.log('Public', b2h(keys.public));
			t.assert(keys.exist);
			t.assert(!!keys.name);
			t.assert(!!keys.public);

			client.api.createKeys(true, function(err, keys) {
				if (err) throw err;
				console.log('Created keys 2');
				console.log('Name', b2h(keys.name));
				console.log('Public', b2h(keys.public));
				t.assert(keys.exist);
				t.assert(!!keys.name);
				t.assert(!!keys.public);

				client.api.createKeys(false, function(err, keys) {
					if (err) console.log('Didnt overwrite keys with force=false')
					t.assert(!!err);
					t.end();
				});
			});
		});
	});

	tape('get', function(t) {
		clearDatadir(opts);
		var phoenixRpc = require('../');
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);		

		client.api.createKeys(false, function(err, keys) {
			if (err) throw err;
			console.log('Created keys');
			console.log('Name', b2h(keys.name));
			console.log('Public', b2h(keys.public));
			t.assert(keys.exist);
			t.assert(!!keys.name);
			t.assert(!!keys.public);

			client.api.getKeys(function(err, keys2) {
				if (err) throw err;
				console.log('Got keys');
				console.log('Name', b2h(keys2.name));
				console.log('Public', b2h(keys2.public));
				t.assert(keys2.exist);
				t.assert(b2h(keys.name) == b2h(keys2.name));
				t.assert(b2h(keys.public) == b2h(keys2.public));
				t.end();
			});
		});
	});

	tape('sign and verify', function(t) {
		clearDatadir(opts);
		var phoenixRpc = require('../');
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);		

		client.api.createKeys(false, function(err, keys) {
			if (err) throw err;
			console.log('Created keys');
			console.log('Name', b2h(keys.name));
			console.log('Public', b2h(keys.public));
			t.assert(keys.exist);
			t.assert(!!keys.name);
			t.assert(!!keys.public);

			var buff = new Buffer('this came from bob');

			client.api.sign(buff, function(err, sig) {
				if (err) throw err;
				console.log('Got signature', sig.toString('hex'));
				t.assert(!!sig)
				client.api.verify(buff, sig, false, function(err, verified) {
					if (err) throw err
					t.assert(verified)
					console.log('verified')
					t.end()
				})
			});
		});
	});
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data' });
