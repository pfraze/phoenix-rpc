exports._setup = function(opts) {
	this.friends = this.ssb.app('friend') || this.ssb.use(require('secure-scuttlebutt/apps/friends'));
}

exports.friends_follow = function(obj, cb) {
	this.friends.follow(this.feed, obj, cb);
};

exports.friends_unfollow = function(obj, cb) {
	this.friends.unfollow(this.feed, obj, cb);
};