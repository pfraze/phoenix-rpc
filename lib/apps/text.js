exports.manifest = {
  methods: {
    text_getPost: { type: 'async' },
    text_post: { type: 'async' }
  }
}

exports.instance = function(opts, ssb) {
  var text = {}
  var textApp = ssb.internalInst.app('text') || ssb.internalInst.use(require('secure-scuttlebutt/apps/text'))

  text.text_getPost = function(messageid, cb) {
    textApp.getPost(messageid, cb)
  }

  text.text_post = function(text, cb) {
    textApp.post(ssb.feed, text, cb)
  }

  return text
}
