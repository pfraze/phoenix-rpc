var path = require('path');
var fs   = require('fs');
var net  = require('net');
var rpc  = require('rpc-stream');
var api  = require('./lib/rpc-api');

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
	var stream = net.connect(port);
	var client = rpc();
	client.pipe(stream).pipe(client);

	var clientApi = client.wrap(api.names);
	clientApi._port = port;
	
	cb(null, clientApi, stream);
};

exports.createServer = function(opts, cb) {
	prepOpts(opts);

	// Create server
	var apiInst = api.create(opts);;
	var server = net.createServer(rpcServer(apiInst));

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
	server.cleanup = function(cb) {
		fs.unlinkSync(opts.portfile);
	};
	server.listen(port, 'localhost');

	function randomPort() {
		return 64001 + Math.ceil(Math.random() * 998);
	}
};

function rpcServer(apiInst) {
	return function (stream) {
		var server = rpc(apiInst);
		server.pipe(stream).pipe(server);
	}
}
