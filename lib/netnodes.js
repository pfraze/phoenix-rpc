var pull = require('pull-stream');
var pl   = require('pull-level');

exports._setup = function(opts) {
	Object.defineProperty(this, 'netNodesDB', { enumerable: false, value: this.db.sublevel('netnodes', { valueEncoding: 'json' }) });
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

exports.delNode = function(addr, port, cb) {
	this.netNodesDB.del([addr, +port], cb);
};
