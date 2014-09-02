var SSB      = require('secure-scuttlebutt');
var toStream = require('pull-stream-to-stream');

var ssbs = {};

exports._setup = function(opts) {
	this.ssb = ssbs[opts.datadir] = (ssbs[opts.datadir] || SSB(this.db, require('secure-scuttlebutt/defaults')));
	if (this.keys.exist)
		this.feed = this.ssb.createFeed(this.keys);
};

exports.createFeedStream = function(opts) {
	return toStream.source(this.ssb.createFeedStream(opts));
};
exports.createFeedStream.type = 'readable';

exports.following = function() {
	return toStream.source(this.ssb.following());
};
exports.following.type = 'readable';

exports.follow = function(pubkey, cb) {
	this.ssb.follow(new Buffer(pubkey, 'hex'), cb);
};

exports.unfollow = function(pubkey, cb) {
	this.ssb.unfollow(new Buffer(pubkey, 'hex'), cb);
};

exports.addMessage = function(type, message, cb) {
	if (!this.feed)
		return cb(new Error('No feed has been created'));
	this.feed.add(type, message, cb);
};

exports.createLogStream = function(opts) {
	var pull = require('pull-stream');
	return toStream.source(this.ssb.createLogStream());
};
exports.createLogStream.type = 'readable';

exports.createReplicationStream = function(opts, cb) {
	var pull = require('pull-stream');
	return toStream(this.ssb.createReplicationStream(opts, cb));
};
exports.createReplicationStream.type = 'duplex';