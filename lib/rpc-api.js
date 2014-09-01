var level       = require('level');
var sublevel    = require('level-sublevel/bytewise');
var scuttleopts = require('secure-scuttlebutt/defaults');

var setups = [];
var methods = {};
var dbs = {};
methods.ping = function(x, cb) {
	cb(null, x + 1);
};

[
	require('./keys'),
	require('./netnodes')
	// require('./ssb')
].forEach(function(api) {
	for (var k in api) {
		if (k == '_setup') {
			setups.push(api[k]);
			continue;
		}
		methods[k] = api[k];
	}
});

exports.names = Object.keys(methods);
exports.create = function(opts) {
	var inst = {};
	for (var k in methods)
		inst[k] = methods[k];
	inst.opts = opts;
	inst.db = dbs[opts.dbpath] || sublevel(level(opts.dbpath, {
		valueEncoding: scuttleopts.codec
	}));
	dbs[opts.dbpath] = inst.db;
	setups.forEach(function(setup) { setup.call(inst, opts); });
	return inst;
}