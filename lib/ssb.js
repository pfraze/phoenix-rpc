var SSB      = require('secure-scuttlebutt');
var toStream = require('pull-stream-to-stream');

var ssbs = {};

exports._setup = function(opts) {
	this.ssb = ssbs[opts.datadir] = (ssbs[opts.datadir] || SSB(this.db, require('secure-scuttlebutt/defaults')));
	if (this.keys.exist)
		this.feed = this.ssb.createFeed(this.keys);
};

exports.getPublicKey = function(id, cb) {
	return this.ssb.getPublicKey(id, cb);
};

exports.createFeedStream = function(opts) {
	return toStream.source(this.ssb.createFeedStream(opts));
};
exports.createFeedStream.type = 'readable';

exports.following = function() {
	return toStream.source(this.ssb.following());
};
exports.following.type = 'readable';

exports.follow = function(id, cb) {
	this.ssb.follow(id, cb);
};

exports.unfollow = function(id, cb) {
	this.ssb.unfollow(id, cb);
};

exports.isFollowing = function(id, cb) {
	this.ssb.isFollowing(id, cb)
}

exports.addMessage = function(type, message, cb) {
	if (!this.feed)
		return cb(new Error('No feed has been created'));
	this.feed.add(type, message, cb);
};

exports.createHistoryStream = function(id, seq, live) {
	var pull = require('pull-stream');
	return toStream.source(this.ssb.createHistoryStream(id, seq, live));
};
exports.createHistoryStream.type = 'readable';

exports.createLogStream = function(opts) {
	var pull = require('pull-stream');
	return toStream.source(this.ssb.createLogStream());
};
exports.createLogStream.type = 'readable';

exports.createReplicationStream = function(opts) {
	var pull = require('pull-stream');
	return toStream(this.ssb.createReplicationStream(opts||{}, function() {}));
};
exports.createReplicationStream.type = 'duplex';
