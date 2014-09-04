exports._setup = function(opts) {
	this.profile = this.ssb.app('profile') || this.ssb.use(require('secure-scuttlebutt/apps/profile'));
}

exports.profile_getProfile = function(userid, cb) {
	this.profile.getProfile(userid, cb);
};

exports.profile_lookupByNickname = function(nickname, cb) {
	this.profile.lookupByNickname(nickname, cb);
};

exports.profile_setNickname = function(nickname, cb) {
	this.profile.setNickname(this.feed, nickname, cb);
};