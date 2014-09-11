var stream      = require('stream');
var through     = require('through');
var debug       = require('./debug');

var dbs = {};
var setups = [];
var methods = {};

// Load the API
[
	require('./keys'),
	require('./netnodes'),
	require('./ssb'),
	require('./apps/text'),
	require('./apps/profile'),
	require('./apps/friends')
].forEach(function(api) {
	for (var k in api) {
		if (k == '_setup') {
			setups.push(api[k]);
			continue;
		}
		methods[k] = api[k];
		if (!methods[k].type)
			methods[k].type = 'async'
	}
});

// Test API
methods.ping = function(x, cb) {
	x = x || 0;
	cb(null, x + 1);
};
methods.pingStream = function(x) {
	x = x || 0;
	var n = 0;
	var s = through();
	var i = setInterval(function() {
		s.write(''+x, 'utf8');
		++x;
		if (++n == 3)
			clearInterval(i), s.end();
	}, 10);
	return s;
}
methods.pingStream.type = 'duplex';
// var methodSigs = {"getKeys":{"type":"async"},"createKeys":{"type":"async"},"sign":{"type":"async"},"verify":{"type":"async"},"getSyncState":{"type":"async"},"getNodes":{"type":"async"},"getNode":{"type":"async"},"addNode":{"type":"async"},"addNodes":{"type":"async"},"delNode":{"type":"async"},"syncNetwork":{"type":"async"},"getPublicKey":{"type":"async"},"createFeedStream":{"type":"readable"},"following":{"type":"readable"},"follow":{"type":"async"},"unfollow":{"type":"async"},"isFollowing":{"type":"async"},"addMessage":{"type":"async"},"createHistoryStream":{"type":"readable"},"createLogStream":{"type":"readable"},"createReplicationStream":{"type":"duplex"},"text_getPost":{"type":"async"},"text_post":{"type":"async"},"profile_getProfile":{"type":"async"},"profile_lookupByNickname":{"type":"async"},"profile_setNickname":{"type":"async"},"friends_follow":{"type":"async"},"friends_unfollow":{"type":"async"},"ping":{"type":"async"},"pingStream":{"type":"duplex"}};

// Actual API

(function() {
	// Server-side

	exports.createServer = function(opts) {
		// Include server-only dependencies
		var level       = require('level');
		var sublevel    = require('level-sublevel/bytewise');
		var scuttleopts = require('secure-scuttlebutt/defaults');

		// Build the api instance
		var inst = {};
		for (var k in methods)
			inst[k] = methods[k];
		inst.opts = opts;
		inst.onStream = onStream;

		// Attach the database (open if DNE)
		inst.db = dbs[opts.dbpath] || sublevel(level(opts.dbpath, {
			valueEncoding: scuttleopts.codec
		}));
		dbs[opts.dbpath] = inst.db;

		// Run api-specific setups
		setups.forEach(function(setup) { setup.call(inst, opts); });
		return inst;
	}

	function onStream(stream) {
		var args = stream.meta;
		var name = args.shift();

		// Run method and hookup to the received stream
		var method = this[name];
		if (method) {
			var mstream = method.apply(this, args);
			if (mstream.readable) mstream.pipe(stream);
			if (mstream.writable) stream.pipe(mstream);
		} else
			setImmediate(function() { stream.error('Method not found') })
	}
})();

(function() {
	// Proxy

	exports.createProxy = function(upstreamApi, allowedMethods) {
		// Build the api instance
		var inst = {};
		for (var k in methods) {
			if (allowedMethods.indexOf(k) !== -1)
				inst[k] = upstreamApi[k].bind(upstreamApi)
			else
				inst[k] = notAllowed
		}
		inst.onStream = function(stream) {
			var args = stream.meta;
			var name = args.shift();

			// Pass to upstream if allowed
			// (errors are emitted next-tick in case the consumer is in the same process and needs time to connect handlers)
			if (name in this) {
				if (allowedMethods.indexOf(name) !== -1)
					stream.pipe(upstreamApi[name].apply(upstreamApi, args)).pipe(stream)
				else {
					setImmediate(function() { stream.error('Method not allowed') })
				}
			} else
				setImmediate(function() { stream.error('Method not found') })
		};

		return inst;
	}

	function notAllowed() {
		var cb = Array.prototype.slice.call(arguments, -1)[0]
		if (typeof cb == 'function') cb(new Error('Method not allowed'))
	}
})();

(function() {
	// Client-side

	exports.createClient = function(rpcclient, mx) {
		// Add methods
		for (var k in methods)
			addMethod(rpcclient, mx, k, methods[k]);

		return rpcclient;
	};

	function addMethod(rpcclient, mx, k, method) {
		switch (method.type) {
			case 'readable': rpcclient[k] = createStreamMethodWrapper(rpcclient, k, mx.createReadStream.bind(mx)); break;
			case 'writable': rpcclient[k] = createStreamMethodWrapper(rpcclient, k, mx.createWriteStream.bind(mx)); break;
			case 'duplex':   rpcclient[k] = createStreamMethodWrapper(rpcclient, k, mx.createStream.bind(mx)); break;
			default:         rpcclient[k] = createRemoteCall(rpcclient, k);
		}
	}

	function createRemoteCall(rpcclient, methodname) {
		return function() {
			var args = Array.prototype.slice.call(arguments)
			var cb = ('function' == typeof args[args.length - 1])
				? args.pop()
				: null;
			rpcclient.rpc(methodname, args, cb);
		}
	}

	function createStreamMethodWrapper(rpcclient, methodname, createStream) {
		return function() {
			// Send RPC methodname and args as the substream meta
			var args = Array.prototype.slice.call(arguments);
			args.unshift(methodname);
			debug.logMX('client, sending streamcall', args);
			return createStream(args);
		};
	}
})();