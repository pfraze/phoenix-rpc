var setups = [];
var methods = {};
methods.ping = function(x, cb) {
	cb(null, x + 1);
};

[
	require('./keys')
	// require('./netnodes'),
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
	Object.defineProperty(inst, 'opts', { enumerable: false, value: opts });
	setups.forEach(function(setup) { setup.call(inst, opts); });
	return inst;
}