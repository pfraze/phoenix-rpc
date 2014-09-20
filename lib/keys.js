exports.manifest = {
  methods: {
    getKeys:    { type: 'async' },
    createKeys: { type: 'async' },
    sign:       { type: 'async' },
    verify:     { type: 'async' }
  }
}
exports.instance = function(opts) {
  var keys = new (require('events')).EventEmitter()

  // Load dependencies (cant be toplevel or clients in the browser fail to run)
  var fs       = require('fs')
  var crypto   = require('crypto')
  var proquint = require('proquint-')
  var ecc      = require('eccjs')
  var k256     = ecc.curves.k256
  var Blake2s  = require('blake2s')

  function bsum (value) {
    return new Blake2s().update(value).digest()
  }

  // Load keys
  try {
    var privateKey = proquint.decode(fs.readFileSync(opts.namefile, 'ascii').replace(/\s*\#[^\n]*/g, ''))
    var k = ecc.restore(k256, privateKey)
    keys.private = k.private
    keys.public  = k.public
    keys.name    = bsum(k.public)
    keys.exist   = true
  } catch (e) {
    keys.private = null
    keys.public  = null
    keys.name    = null
    keys.exist   = false
  }

  keys.getKeys = function(cb) {
    cb(null, {
      public: keys.public,
      name:   keys.name,  
      exist:  keys.exist
    })
  }

  keys.createKeys = function(force, cb) {
    if(keys.exist && !force) {
      var err = new Error('Keyfile already exists.')
      err.fatal = false
      return cb(err)
    }

    var privateKey = crypto.randomBytes(32)
    var k          = ecc.restore(k256, privateKey)
    var name       = bsum(k.public)

    var contents = [
    '# this is your SECRET name.',
    '# this name gives you magical powers.',
    '# with it you can mark your messages so that your friends can verify',
    '# that they really did come from you.',
    '#',
    '# if any one learns this name, they can use it to destroy your identity',
    '# NEVER show this to anyone!!!',
    '',
    proquint.encodeCamelDash(k.private),
    '',
    '# notice that it is quite long.',
    '# it\'s vital that you do not edit your name',
    '# instead, share your public name',
    '# your public name: ' + proquint.encode(name),
    '# or as a hash : ' + name.toString('hex')
    ].join('\n')

    fs.writeFile(opts.namefile, contents, function(err) {
      if (err) {
        err.fatal = true
        return cb(err)
      }
      keys.private = k.private
      keys.public  = k.public
      keys.name    = name
      keys.exist   = true
      keys.emit('created')
      cb(null, {
        public: keys.public,
        name:   keys.name,  
        exist:  keys.exist
      })
    })
  }

  keys.sign = function(buffer, cb) {
    if (!keys.exist)
      return cb(new Error('No keys available to sign'))
    var hash = crypto.createHash('sha256').update(buffer).digest()
    cb(null, ecc.sign(k256, keys.private, hash))
  }

  keys.verify = function(buffer, sig, key, cb) {
    if (!key) key = keys.public
    if (!key) return cb(new Error('No keys available to sign'))
    var hash = crypto.createHash('sha256').update(buffer).digest()
    cb(null, ecc.verify(k256, key, sig, hash))
  }

  return keys
}