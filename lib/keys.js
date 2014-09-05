var fs       = require('fs');
var crypto   = require('crypto');
var proquint = require('proquint-');
var ecc      = require('eccjs');
var k256     = ecc.curves.k256;
var Blake2s  = require('blake2s');

function bsum (value) {
	return new Blake2s().update(value).digest();
}

exports._setup = function(opts) {
	this.keys = {};
	try {
		var privateKey = proquint.decode(fs.readFileSync(opts.namefile, 'ascii').replace(/\s*\#[^\n]*/g, ''));
		var keys = ecc.restore(k256, privateKey);
		this.keys.private = keys.private;
		this.keys.public  = keys.public;
		this.keys.name    = bsum(keys.public);
		this.keys.exist   = true;
	} catch (e) {
		this.keys.private = null;
		this.keys.public  = null;
		this.keys.name    = null;
		this.keys.exist   = false;
	}
}

exports.getKeys = function(cb) {
	cb(null, {
		public: this.keys.public,
		name:   this.keys.name,  
		exist:  this.keys.exist
	})
};

exports.createKeys = function(force, cb) {
	if(this.keys.exist && !force) {
		var err = new Error('Keyfile already exists, use --force-new-keypair to overwrite it.');
		err.fatal = false;
		return cb(err);
	}

	var privateKey = crypto.randomBytes(32);
	var keys       = ecc.restore(k256, privateKey);
	var name       = bsum(keys.public);

	var contents = [
	'# this is your SECRET name.',
	'# this name gives you magical powers.',
	'# with it you can mark your messages so that your friends can verify',
	'# that they really did come from you.',
	'#',
	'# if any one learns this name, they can use it to destroy your identity',
	'# NEVER show this to anyone!!!',
	'',
	proquint.encodeCamelDash(keys.private),
	'',
	'# notice that it is quite long.',
	'# it\'s vital that you do not edit your name',
	'# instead, share your public name',
	'# your public name: ' + proquint.encode(name),
	'# or as a hash : ' + name.toString('hex')
	].join('\n');

	fs.writeFile(this.opts.namefile, contents, function(err) {
		if (err) {
			err.fatal = true;
		} else {
			this.keys.private = keys.private;
			this.keys.public  = keys.public;
			this.keys.name    = name;
			this.keys.exist   = true;
			if (this.ssb)
				this.feed = this.ssb.createFeed(this.keys);
		}
		cb(err, {
			public: this.keys.public,
			name:   this.keys.name,  
			exist:  this.keys.exist
		});
	}.bind(this));
};

exports.sign = function(buffer, cb) {
	if (!this.keys.exist)
		return cb(new Error('No keys available to sign'))
	var hash = crypto.createHash('sha256').update(buffer).digest();
	cb(null, ecc.sign(k256, this.keys.private, hash));
};

exports.verify = function(buffer, sig, key, cb) {
	if (!key) key = this.keys.public;
	if (!key) return cb(new Error('No keys available to sign'))
	var hash = crypto.createHash('sha256').update(buffer).digest();
	cb(null, ecc.verify(k256, key, sig, hash));
};