var path     = require('path');
var fs       = require('fs');
var net      = require('net');
var rpc      = require('rpc-stream');
var MuxDemux = require('mux-demux/msgpack')
var api      = require('./lib/rpc-api');
var debug    = require('./lib/debug');

function prepOpts(opts) {
	if (!opts) throw "opts are required";
	if (!opts.datadir) throw "opts.datadir is required";
	if (!opts.port) opts.port = 64050;

	// Build dependent values
	if (!opts.namefile)
		opts.namefile = path.join(opts.datadir, 'secret.name');
	if (!opts.dbpath)
		opts.dbpath = path.join(opts.datadir, 'database');
}

exports.createServerOrConnect = function(opts, cb) {
	prepOpts(opts);

	// Portfile exists?
	var stream;
	exports.connect(+opts.port, function(err, clientApi, stream) {
		if (err) {
			if (err.code != 'ECONNREFUSED') return cb(err);
			console.log('moving on...')
			// Create server and connect
			exports.createServer(opts, function(err, server) {
				if (err) return cb(err);
				exports.connect(+opts.port, function(err, clientApi, stream) {
					console.log('what?', err)
					if (err) return cb(err);
					clientApi._server = server;
					clientApi.close = function() {
						server.close();
						stream.end();
					};
					cb(null, clientApi, stream);
				});
			});
		} else {
			cb(null, clientApi, stream);
		}
	});
};

exports.connect = function(port, cb) {
	// Create stream
	var stream = net.connect(port, function() {
		console.log('connected', arguments);

		// Pipe into mux-demux
		var mx = MuxDemux();
		stream.pipe(mx).pipe(stream);

		// Create the rpc substream
		debug.logMX('client, creating rpc substream over muxdemux');
		var clientApi = api.createClient(rpc());
		clientApi.pipe(mx.createStream('rpc')).pipe(clientApi);
		clientApi._mx = mx;
		clientApi.close = stream.end.bind(stream);
		cb(null, clientApi, stream);
	});
	stream.on('error', cb);
};

exports.createServer = function(opts, cb) {
	prepOpts(opts);

	// Create server
	var serverApi = api.createServer(opts);
	var server = net.createServer(function (s) {
		// Pipe into mux-demux
		var mx = MuxDemux();
		s.pipe(mx).pipe(s);

		// Handle new substreams
		mx.on('connection', function(stream) {
			if (stream.meta == 'rpc') {
				// RPC substream
				debug.logMX('server, received rpc substream over muxdemux');
				var rpcstream = rpc(serverApi);
				rpcstream.pipe(stream).pipe(rpcstream);
			} else {
				// Others
				serverApi.onStream(stream);
			}
		});
	});
	server.listen(+opts.port, 'localhost');
	server.on('listening', function() {
		cb(null, server);
	});
	server.on('error', cb);
};
