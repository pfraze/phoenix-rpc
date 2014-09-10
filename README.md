# Phoenix API Server

![phoenix-rpc](phoenix-rpc.png)

Backend server to the [Phoenix Distributed Social-Network](https://github.com/pfraze/phoenix). Provides the backend API over a RPC stream, allowing multiple simultaneous frontends and clients.


```javascript
var prpc = require('phoenix-rpc');

// Start the backend and connect a client to it
var server = prpc.server({ datadir: './.phoenix' });
var client = prpc.client();
client.pipe(server).pipe(client);

// Fetch the local user's public key and fingerprint (name)
client.api.getKeys(function(err, keys) {
	if (err) throw err;
	if (keys.exist) {
		console.log(keys.public.toString('hex'));
		console.log(keys.name.toString('hex'));
	}
});

// Create new keys
client.api.createKeys(false, function(err, keys) {
	if (err) throw err;
	console.log(keys.public.toString('hex'));
	console.log(keys.name.toString('hex'));

	var buff = new Buffer('this was definitely written by bob')
	client.api.sign(buff, function(err, sig) {
		client.api.verify(buff, sig, keys.public, function(err, verified) {
			console.log(verified); // => true
		});
});

// Manage the network table
client.api.getNodes(function(err, nodes) {
	if (err) throw err;
	console.log(nodes); // [['foo.com', 8080], ['bar.com', 123]]
});
client.api.addNode('baz.com', 1000, function(err) {
	if (err) throw err;
	client.api.delNode('baz.com', 1000, function(err) {
		if (err) throw err;
	});
});
client.api.addNodes(['foo.com', ['baz.com', 1000], 'bar.com:123'], function(err) {
	if (err) throw err;
})
client.api.syncNetwork({ timeout: 3000 }, function(err, results) {
	if (err) throw err;
	for (var host in results) {
		if (results[host].error)
			console.error(host, 'failed to sync', results[host].msg)
		else
			console.log(host, 'synced in', results[host].elapsed, 'ms')
	}

	client.api.getSyncState(function(err, state) {
		if (err) throw err
		console.log('Last synced on', new Date(sync.lastSync))
		client.api.syncNetwork({ ifOlderThan: 1000*60 }, function(err, results) {
			if (err) throw err
			if (Object.keys(results).length == 0)
				console.log('Synced within the last 60s, not syncing again')
		})
	})
})

// Wrappers around SSB. NOTE:
// - these return node's streams, not domenic's pull-streams. Use stream-to-pull-stream to convert them
// - unlike ssb, only supports 1 local feed
client.api.getPublicKey(id, cp);
client.api.createFeedStream(opts);
client.api.following();	
client.api.follow(id, cb);
client.api.unfollow(id, cb);
client.api.isFollowing(id, cb);
client.api.addMessage(type, message, cb);
client.api.createLogStream(opts);
client.api.createHistoryStream(id, seq, live)
client.api.createReplicationStream(opts); // :NOTE: does not currently support the 'end' callback

// Create a proxy that only allows the ping method
var proxy = prpc.proxy(client, ['ping']);
var client2 = prpc.client();
client2.pipe(proxy).pipe(client2);
client2.api.ping(1, function(err, x) {
	console.log(x); // => 2
});
client2.api.getKeys(function(err, keys) {
	console.log(err) // => [Error: Not allowed]
});
```

### Why the RPC?

 - LevelDB, Phoenix's internal storage engine, is single-threaded. Without the RPC server, only one program could access the db at a time.
 - Phoenix is designed to be accessed by downstream applications, much like Postgres or Redis is. This is how they do it.
