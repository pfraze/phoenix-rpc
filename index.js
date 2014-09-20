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

	// Build dependent values
	if (!opts.namefile)
		opts.namefile = path.join(opts.datadir, 'secret.name');
	if (!opts.dbpath)
		opts.dbpath = path.join(opts.datadir, 'database');
}

exports.client = function() {
	var mx = MuxDemux();
	debug.logMX('client, creating rpc substream over muxdemux');
	var clientApi = api.createClient(rpc(null, {raw:true}), mx);
	clientApi.pipe(mx.createStream('rpc')).pipe(clientApi);
	mx.api = clientApi;
	return mx;
};

exports.server = function(opts) {
	prepOpts(opts);

	var serverApi = api.createServer(opts);
	var mx = MuxDemux();

	// Handle new substreams
	mx.on('connection', function(stream) {
		if (stream.meta == 'rpc') {
			// RPC substream
			debug.logMX('server, received rpc substream over muxdemux');
			var rpcstream = rpc(serverApi, {raw:true});
			rpcstream.pipe(stream).pipe(rpcstream);
		} else {
			// Others
			debug.logMX('server, received streamcall', stream.meta);
			serverApi.onStream(stream);
		}
	});

	return mx;
};

exports.proxy = function(upstreamApi, allowedMethods) {
	
	var proxyApi = api.createProxy(upstreamApi, allowedMethods);
	var mx = MuxDemux();

	// Handle new substreams
	mx.on('connection', function(stream) {
		if (stream.meta == 'rpc') {
			// RPC substream
			debug.logMX('proxy, received rpc substream over muxdemux');
			var rpcstream = rpc(proxyApi, {raw:true});
			rpcstream.pipe(stream).pipe(rpcstream);
		} else {
			// Others
			debug.logMX('proxy, received streamcall', stream.meta);
			proxyApi.onStream(stream)
		}
	});
	
	return mx;
};
