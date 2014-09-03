var stream      = require('stream');
var through     = require('through');
var level       = require('level');
var sublevel    = require('level-sublevel/bytewise');
var scuttleopts = require('secure-scuttlebutt/defaults');
var debug       = require('./debug');

var setups = [];
var methods = {};
var dbs = {};

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
		console.log('pingstream', x);
		s.write(''+x, 'utf8');
		++x;
		if (++n == 3)
			clearInterval(i), s.end();
	}, 10);
	console.log('created pingStream')
	return s;
}
methods.pingStream.type = 'duplex';

// Actual API
[
	require('./keys'),
	require('./netnodes'),
	require('./ssb')
].forEach(function(api) {
	for (var k in api) {
		if (k == '_setup') {
			setups.push(api[k]);
			continue;
		}
		methods[k] = api[k];
	}
});

(function() {
	// Server-side

	exports.createServer = function(opts) {
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
		debug.logMX('server, received streamcall', stream.meta);

		var args = stream.meta;
		var name = args.shift();

		// Run method and hookup to the received stream
		var method = this[name];
		var mstream = method.apply(this, stream.meta);
		if (mstream.readable) mstream.pipe(stream);
		if (mstream.writable) stream.pipe(mstream);
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