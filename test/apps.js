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
	tape('text', function(t) {
		clearDatadir(opts);
		var phoenixRpc = require('../');
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);
	
		client.api.createKeys(false, function(err, keys) {
			if (err) throw err;

			client.api.text_post('hello, world', function(err, msg, id) {
				if (err) throw err;
				console.log('posted', b2h(id))

				client.api.text_getPost(id, function(err, text) {
					if (err) throw err

					t.equal(text, 'hello, world')
					t.end()
				})
			})
		})
	});

	tape('profile', function(t) {
		clearDatadir(opts);
		var phoenixRpc = require('../');
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);
	
		client.api.createKeys(false, function(err, keys) {
			if (err) throw err;

			client.api.profile_setNickname('bob', function(err) {
				if (err) throw err;
				console.log('set nickname')

				client.api.profile_getProfile(keys.name, function(err, profile) {
					if (err) throw err
					console.log('got profile', profile)
					t.equal(profile.nickname, 'bob')
					client.api.profile_lookupByNickname('bob', function(err, ids) {
						if (err) throw err
						console.log('looked up bob, got', ids.map(b2h))
						t.equal(b2h(keys.name), b2h(ids[0]))
						t.end()
					})
				})
			})
		})
	})

	// :TODO: friends
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data' });
