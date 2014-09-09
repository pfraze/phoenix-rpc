'use strict'
var tape = require('tape');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var http = require('http')
var pull = require('pull-stream')
var toPull = require('stream-to-pull-stream')

function clearDatadir(opts) {
	try { rimraf.sync(path.join(opts.datadir, 'database')); console.log('Deleted old db'); } catch (e) { console.error(e)}
}

module.exports = function(opts, opts2) {
	clearDatadir(opts)
	clearDatadir(opts2)

	tape('methods', function(t) {
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

	tape('sync', function(t) {
		var phoenixRpc = require('../');
		var client1 = phoenixRpc.client();
		client1.pipe(phoenixRpc.server(opts)).pipe(client1);
		var client2 = phoenixRpc.client();
		client2.pipe(phoenixRpc.server(opts2)).pipe(client2);

		console.log('creating target server')
		var server = http.createServer()
		server.on('connect', function(req, s) {
			console.log('Received CONNECT')
			s.write('HTTP/1.1 200 Connection Established\r\n\r\n')
			s.pipe(phoenixRpc.server(opts2)).pipe(s);
		});
		server.listen(+opts2.port, 'localhost');
		server.on('listening', function() {
			console.log('target server listening on', opts2.port)
	
			console.log('adding node');
			client1.api.addNode('localhost', opts2.port, function(err) {
				if (err) throw err;
				console.log('added localhost:'+opts2.port);
				
				console.log('populating datasets')
				populateDatasets([client1, client2], function(err, ids) {
					if (err) throw err

					console.log('following', ids)
					var n=0
					client1.api.follow(ids[1], handleFollow)
					client2.api.follow(ids[0], handleFollow)
					function handleFollow(err) {
						if (err) throw err
						if (++n < 2) return

						console.log('syncing')
						client1.api.syncNetwork(function(err, results) {
							if (err) throw err

							setTimeout(function() {
								console.log('synced, comparing feeds', results)
								var feeds = [];
								var next = function(err, feed) {
									if (err) throw err;
									feeds.push(feed);
									if (feeds.length == 2) {
										t.deepEqual(feeds[0], feeds[1]);
										server.close()
										t.end();
									}
								}
								pull(toPull(client1.api.createFeedStream()), pull.collect(next));
								pull(toPull(client2.api.createFeedStream()), pull.collect(next));
							}, 300) // wait 300ms because the repl-stream 'end' doesnt tell us the other server has finished processing
						})
					}
				})
			})
		})

		function populateDatasets(clients, cb) {
			var ids = [];
			clients.forEach(function(client) {
				populateDataset(client, function(err, id) {
					if (err) { n = -1; cb(err); }
					ids.push(id)
					if (ids.length === clients.length)
						cb(null, ids)
				})
			})
		}

		function populateDataset(client, cb) {
			client.api.createKeys(true, function(err, key) {
				var calls = 0
				client.api.addMessage('text', 'message '+(Math.random()%50), handleAddMsg)
				client.api.addMessage('text', 'message '+(Math.random()%50), handleAddMsg)
				client.api.addMessage('text', 'message '+(Math.random()%50), handleAddMsg)
				function handleAddMsg(err) {
					if (err) { calls = -1; return cb(err) }
					console.log('added message', calls+1);
					if (++calls < 3) return;
					cb(null, key.name)
				}
			})
		}
	})

	tape('addNodes', function(t) {
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
				t.equal(nodes.length, 4);
				t.equal(nodes[0][0], 'bar.com');
				t.equal(nodes[0][1], 456);
				t.equal(nodes[1][0], 'baz.com');
				t.equal(nodes[1][1], 64000);
				t.equal(nodes[2][0], 'foo.com');
				t.equal(nodes[2][1], 123);
				t.equal(nodes[3][0], 'localhost');
				t.equal(nodes[3][1], 63999);
				t.end();
			});
		});
	});
};

if(!module.parent)
	module.exports({ datadir: __dirname + '/.data' }, { datadir: __dirname + '/.data2', port: 63999 });
