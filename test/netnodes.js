'use strict'
var tape = require('tape');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');

function clearDatadir(opts) {
	try { rimraf.sync(path.join(opts.datadir, 'database')); console.log('Deleted old db'); } catch (e) { console.error(e)}
}

module.exports = function(opts) {
	tape('methods', function(t) {
		clearDatadir(opts);
		var phoenixRpc = require('../');
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);
	
		console.log('adding node');
		client.api.addNode('foo.com', 123, function(err) {
			if (err) throw err;
			console.log('added foo.com:123');
			
			client.api.getNodes(function(err, nodes) {
				if (err) throw err;
				console.log('got nodes', nodes);
				t.equal(1, nodes.length);
				t.equal('foo.com', nodes[0][0]);
				t.equal(123, nodes[0][1]);

				client.api.delNode('foo.com', 123, function(err) {
					if (err) throw err;
					console.log('deleted foo.com:123');
					
					client.api.getNodes(function(err, nodes) {
						if (err) throw err;
						console.log('got nodes', nodes);
						t.equal(0, nodes.length);

						client.end();
						server.end();
						t.end();
					});
				});
			});
		});
	});
	tape('addNodes', function(t) {
		clearDatadir(opts);
		var phoenixRpc = require('../');
		var server = phoenixRpc.server(opts);
		var client = phoenixRpc.client();
		client.pipe(server).pipe(client);
	
		console.log('adding nodes');
		client.api.addNodes([['foo.com', 123], 'bar.com:456', 'baz.com'], function(err) {
			if (err) throw err;
			console.log('added foo.com:123, bar.com:456, baz.com');
			
			client.api.getNodes(function(err, nodes) {
				if (err) throw err;
				console.log('got nodes', nodes);
				t.equal(3, nodes.length);
				t.equal('bar.com', nodes[0][0]);
				t.equal(456, nodes[0][1]);
				t.equal('baz.com', nodes[1][0]);
				t.equal(64000, nodes[1][1]);
				t.equal('foo.com', nodes[2][0]);
				t.equal(123, nodes[2][1]);
				t.end();
			});
		});
	});
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data' });
