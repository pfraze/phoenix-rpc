var ssbInstances = {}
exports.manifest = {
  methods: {
    getPublicKey:            { type: 'async' },
    createFeedStream:        { type: 'readable' },
    following:               { type: 'readable' },
    follow:                  { type: 'async' },
    unfollow:                { type: 'async' },
    isFollowing:             { type: 'async' },
    addMessage:              { type: 'async' },
    createHistoryStream:     { type: 'readable' },
    createLogStream:         { type: 'readable' },
    createReplicationStream: { type: 'duplex' }
  }
}
exports.instance = function(opts, db, keys) {
  var ssb = { feed: null, internalInst: null }

  // load dependencies (cant be toplevel or clients in the browser fail to run)
  var SSB      = require('secure-scuttlebutt')
  var toStream = require('pull-stream-to-stream')

  // open ssb instance
  ssb.internalInst = ssbInstances[opts.datadir] = (ssbInstances[opts.datadir] || SSB(db, require('secure-scuttlebutt/defaults')))
  if (keys.exist) ssb.feed = ssb.internalInst.createFeed(keys)
  keys.on('created', function() {
    ssb.feed = ssb.internalInst.createFeed(keys)
  })

  ssb.getPublicKey = function(id, cb) {
    return ssb.internalInst.getPublicKey(id, cb)
  }

  ssb.createFeedStream = function(opts) {
    return toStream.source(ssb.internalInst.createFeedStream(opts))
  }

  ssb.following = function() {
    return toStream.source(ssb.internalInst.following())
  }

  ssb.follow = function(id, cb) {
    ssb.internalInst.follow(id, cb)
  }

  ssb.unfollow = function(id, cb) {
    ssb.internalInst.unfollow(id, cb)
  }

  ssb.isFollowing = function(id, cb) {
    ssb.internalInst.isFollowing(id, cb)
  }

  ssb.addMessage = function(type, message, cb) {
    if (!ssb.feed)
      return cb(new Error('No feed has been created'))
    ssb.feed.add(type, message, cb)
  }

  ssb.createHistoryStream = function(id, seq, live) {
    var pull = require('pull-stream')
    return toStream.source(ssb.internalInst.createHistoryStream(id, seq, live))
  }

  ssb.createLogStream = function(opts) {
    var pull = require('pull-stream')
    return toStream.source(ssb.internalInst.createLogStream())
  }

  ssb.createReplicationStream = function(opts) {
    var pull = require('pull-stream')
    return toStream(ssb.internalInst.createReplicationStream(opts||{}, function() {}))
  }

  return ssb
}