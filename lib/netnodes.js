var pull = require('pull-stream');
var pl   = require('pull-level');

exports._setup = function(opts) {
	this.netNodesDB = this.db.sublevel('netnodes', { valueEncoding: 'json' });
}

exports.getNodes = function(cb) {
	pull(
		pl.read(this.netNodesDB, { keys: true, values: false }),
		pull.collect(function(err, nodes) {
			if (err) return cb(err);
			cb(null, nodes);
		})
	)
};

exports.getNode = function(addr, port, cb) {
	this.netNodesDB.get([addr, port], cb);
};

exports.addNode = function(addr, port, cb) {
	this.netNodesDB.put([addr, +port], [], cb);
};

exports.addNodes = function(nodes, cb) {
	if (!nodes || !Array.isArray(nodes) || nodes.length == 0)
		cb(new Error('Must give an array of nodes'))

	var n = 0
	nodes.forEach(function(node) {
		// If a string of 'addr:port', split into [addr, port]
		if (typeof node == 'string')
			node = node.split(':')
		// If no port was given, default to 64000
		if (node.length == 1)
			node[1] = 64000

		this.netNodesDB.put([node[0], +node[1]], [], function(err) {
			if (err) return n = -1, cb(err)
			if (++n == nodes.length) cb()
		});
	}.bind(this))
};

exports.delNode = function(addr, port, cb) {
	this.netNodesDB.del([addr, +port], cb);
};
