'use strict'
var tape = require('tape');
var fs = require('fs');
var path = require('path');

function clearDatadir(opts) {
	try { fs.unlinkSync(path.join(opts.datadir, 'secret.name')); console.log('Deleted old keys'); } catch (e) {}
	try { rimraf.sync(path.join(opts.datadir, 'database')); console.log('Deleted old db'); } catch (e) {}
}

module.exports = function(opts) {
	tape('methods', function(t) {
		var phoenixRpc = require('../');
		
		clearDatadir(opts);

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
					t.equal(1, nodes.length);
					t.equal('foo.com', nodes[0][0]);
					t.equal(123, nodes[0][1]);

					client.delNode('foo.com', 123, function(err) {
						if (err) throw err;
						console.log('deleted foo.com:123');
						
						client.getNodes(function(err, nodes) {
							if (err) throw err;
							console.log('got nodes', nodes);
							t.equal(0, nodes.length);

							client.close();
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
