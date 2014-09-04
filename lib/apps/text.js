exports._setup = function(opts) {
	this.text = this.ssb.app('text') || this.ssb.use(require('secure-scuttlebutt/apps/text'));
}

exports.text_getPost = function(messageid, cb) {
	this.text.getPost(new Buffer(messageid, 'hex'), cb);
};

exports.text_post = function(text, cb) {
	this.text.post(this.feed, text, cb);
};
