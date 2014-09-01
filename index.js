var path     = require('path');
var fs       = require('fs');
var net      = require('net');
var rpc      = require('rpc-stream');
var MuxDemux = require('mux-demux')
var api      = require('./lib/rpc-api');
var debug    = require('./lib/debug');

function prepOpts(opts) {
	if (!opts) throw "opts are required";
	if (!opts.datadir) throw "opts.datadir is required";

	// Build dependent values
	if (!opts.namefile)
		opts.namefile = path.join(opts.datadir, 'secret.name');
	if (!opts.portfile)
		opts.portfile = path.join(opts.datadir, 'phoenix-rpc.port');
	if (!opts.dbpath)
		opts.dbpath = path.join(opts.datadir, 'database');
}

exports.createServerOrConnect = function(opts, cb) {
	prepOpts(opts);

	// Portfile exists?
	var stream;
	fs.exists(opts.portfile, function(exists) {
		if (exists) {
			// Read portfile and connect
			fs.readFile(opts.portfile, {encoding: 'utf8'}, function(err, port) {
				if (err)
					return cb(new Error('Failed to read portfile ' + opts.portfile + ': ' + e.toString()));
				exports.connect(+port, cb);
			});
		} else {
			// Create server and connect
			exports.createServer(opts, function(err, server, port) {
				if (err) return cb(err);
				exports.connect(port, function(err, clientApi, stream) {
					if (err) return cb(err);
					clientApi._server = server;
					cb(null, clientApi, stream);
				});
			});
		}
	});
};

exports.connect = function(port, cb) {
	// Create stream
	var stream = net.connect(port);

	// Pipe into mux-demux
	var mx = MuxDemux();
	stream.pipe(mx).pipe(stream);

	// Create the rpc substream
	debug.logMX('client, creating rpc substream over muxdemux');
	var clientApi = api.createClient(rpc());
	clientApi.pipe(mx.createStream('rpc')).pipe(clientApi);
	clientApi._port = port;
	clientApi._mx = mx;
	cb(null, clientApi, stream);
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

	// Find an open port
	var port = randomPort();
	server.on('listening', function() {
		// Port found, write portfile
		fs.writeFile(opts.portfile, port, {encoding: 'utf8'}, function(err) {
			if (err)
				return cb(new Error('Failed to write portfile ' + opts.portfile + err.toString()));
			// ...and go
			cb(null, server, port);
		});
	});
	server.on('error', function(err) {
		if (e.code == 'EADDRINUSE') {
			// Port in use, try again
			port = randomPort();
			server.listen(port);
		}
	});
	server.listen(port, 'localhost');
	function randomPort() {
		return 64001 + Math.ceil(Math.random() * 998);
	}

	// Helper function, should be called on parent process' exit
	server.cleanup = function(cb) {
		fs.unlinkSync(opts.portfile);
	};
};
