exports.manifest = {
  methods: {
    profile_getProfile: { type: 'async' },
    profile_lookupByNickname: { type: 'async' },
    profile_setNickname: { type: 'async' }
  }
}

exports.instance = function(opts, ssb) {
  var profile = {}
  var profileApp = ssb.internalInst.app('profile') || ssb.internalInst.use(require('secure-scuttlebutt/apps/profile'));

  profile.profile_getProfile = function(userid, cb) {
    profileApp.getProfile(userid, cb)
  }

  profile.profile_lookupByNickname = function(nickname, cb) {
    profileApp.lookupByNickname(nickname, cb)
  }

  profile.profile_setNickname = function(nickname, cb) {
    if (!ssb.feed)
      return cb(new Error('No feed has been created'))
    profileApp.setNickname(ssb.feed, nickname, cb)
  }

  return profile
}