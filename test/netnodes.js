'use strict'
var tape = require('tape');
var fs = require('fs');
var path = require('path');

function clearDatabase(opts) {
	try {
		fs.unlinkSync(path.join(opts.datadir, 'database'));
		console.log('Deleted old database');
	} catch (e) {}
}

module.exports = function(opts) {
	tape('methods', function(t) {
		var phoenixRpc = require('../');
		
		clearDatabase(opts);

		phoenixRpc.createServerOrConnect(opts, function(err, client, stream) {
			if (err) throw err;
			console.log('started at', client._port);

			console.log('adding node');
			client.addNode('foo.com', 123, function(err) {
				if (err) throw err;
				console.log('added foo.com:123');
				
				client.getNodes(function(err, nodes) {
					if (err) throw err;
					console.log('got nodes', nodes);
					t.equal(nodes.length, 1);
					t.equal(nodes[0][0], 'foo.com');
					t.equal(nodes[0][1], 123);

					client.delNode('foo.com', 123, function(err) {
						if (err) throw err;
						console.log('deleted foo.com:123');
						
						client.getNodes(function(err, nodes) {
							if (err) throw err;
							console.log('got nodes', nodes);
							t.equal(nodes.length, 0);

							client._server.cleanup();
							client._server.close();
							stream.end();
							t.end();
						});
					});
				});
			});
		});
	});
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data' });
