exports.manifest = {
  methods: {
    friends_follow: { type: 'async' },
    friends_unfollow: { type: 'async' }
  }
}

exports.instance = function(opts, ssb) {
  var friends = {}
  friendsApp = ssb.internalInst.app('friend') || ssb.internalInst.use(require('secure-scuttlebutt/apps/friends'))

  friends.friends_follow = function(obj, cb) {
    if (!ssb.feed)
      return cb(new Error('No feed has been created'))
    friendsApp.follow(ssb.feed, obj, cb)
  }

  friends.friends_unfollow = function(obj, cb) {
    if (!ssb.feed)
      return cb(new Error('No feed has been created'))
    friendsApp.unfollow(ssb.feed, obj, cb)
  }

  return friends
}