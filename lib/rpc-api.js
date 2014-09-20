var stream      = require('stream');
var through     = require('through');
var debug       = require('./debug');

var dbs = {};

var apis = {
  keys:     require('./keys'),
  netnodes: require('./netnodes'),
  ssb:      require('./ssb'),
  text:     require('./apps/text'),
  profile:  require('./apps/profile'),
  friends:  require('./apps/friends'),
  test: {
    manifest: {
      methods: { ping: { type: 'async' }, pingStream: { type: 'duplex' } }
    },
    instance: function() {
      var test = {}
      test.ping = function(x, cb) {
        x = x || 0
        cb(null, x + 1)
      }
      test.pingStream = function(x) {
        x = x || 0
        var n = 0
        var s = through()
        var i = setInterval(function() {
          s.write(''+x, 'utf8')
          ++x
          if (++n == 3)
            clearInterval(i), s.end()
        }, 10)
        return s
      }
      return test
    }
  }
}

var megaManifest = { methods: {} }
for (var k in apis) {
  for (var m in apis[k].manifest.methods) {
    megaManifest.methods[m] = apis[k].manifest.methods[m]
  }
}

(function() {
  // Server-side

  exports.createServer = function(opts) {
    // include server-only dependencies
    var level       = require('level');
    var sublevel    = require('level-sublevel/bytewise');
    var scuttleopts = require('secure-scuttlebutt/defaults');

    // open the DB
    db = dbs[opts.dbpath] = dbs[opts.dbpath] || sublevel(level(opts.dbpath, { valueEncoding: scuttleopts.codec }));

    // build the api instance
    var keys     = apis.keys.instance(opts)
    var ssb      = apis.ssb.instance(opts, db, keys)
    var netnodes = apis.netnodes.instance(opts, db, ssb)
    var text     = apis.text.instance(opts, ssb)
    var profile  = apis.profile.instance(opts, ssb)
    var friends  = apis.friends.instance(opts, ssb)
    var test     = apis.test.instance()

    var inst = { opts: opts, onStream: onStream };
    addapi(inst, keys,     apis.keys.manifest)
    addapi(inst, ssb,      apis.ssb.manifest)
    addapi(inst, netnodes, apis.netnodes.manifest)
    addapi(inst, text,     apis.text.manifest)
    addapi(inst, profile,  apis.profile.manifest)
    addapi(inst, friends,  apis.friends.manifest)
    addapi(inst, test,     apis.test.manifest)
    return inst;
  }

  function addapi(inst, api, manifest) {
    for (var k in manifest.methods) {
      inst[k] = api[k]
    }
  }

  function onStream(stream) {
    var args = stream.meta;
    var name = args.shift();

    // run method and hookup to the received stream
    var method = this[name];
    if (method) {
      var mstream = method.apply(this, args);
      if (mstream.readable) mstream.pipe(stream);
      if (mstream.writable) stream.pipe(mstream);
    } else
      setImmediate(function() { stream.error('Method not found') })
  }
})();

(function() {
  // Proxy

  exports.createProxy = function(upstreamApi, allowedMethods) {
    // build the api instance
    var inst = {};
    for (var k in megaManifest.methods) {
      if (allowedMethods.indexOf(k) !== -1)
        inst[k] = upstreamApi[k].bind(upstreamApi)
      else
        inst[k] = notAllowed
    }
    inst.onStream = function(stream) {
      var args = stream.meta;
      var name = args.shift();

      // pass to upstream if allowed
      // (errors are emitted next-tick in case the consumer is in the same process and needs time to connect handlers)
      if (name in this) {
        if (allowedMethods.indexOf(name) !== -1)
          stream.pipe(upstreamApi[name].apply(upstreamApi, args)).pipe(stream)
        else {
          setImmediate(function() { stream.error('Method not allowed') })
        }
      } else
        setImmediate(function() { stream.error('Method not found') })
    };

    return inst;
  }

  function notAllowed() {
    var cb = Array.prototype.slice.call(arguments, -1)[0]
    if (typeof cb == 'function') cb(new Error('Method not allowed'))
  }
})();

(function() {
  // Client-side

  exports.createClient = function(rpcclient, mx) {
    // add methods
    for (var k in megaManifest.methods)
      addMethod(rpcclient, mx, k, megaManifest.methods[k]);

    return rpcclient;
  };

  function addMethod(rpcclient, mx, k, method) {
    switch (method.type) {
      case 'readable': rpcclient[k] = createStreamMethodWrapper(rpcclient, k, mx.createReadStream.bind(mx)); break;
      case 'writable': rpcclient[k] = createStreamMethodWrapper(rpcclient, k, mx.createWriteStream.bind(mx)); break;
      case 'duplex':   rpcclient[k] = createStreamMethodWrapper(rpcclient, k, mx.createStream.bind(mx)); break;
      default:         rpcclient[k] = createRemoteCall(rpcclient, k);
    }
  }

  function createRemoteCall(rpcclient, methodname) {
    return function() {
      var args = Array.prototype.slice.call(arguments)
      var cb = ('function' == typeof args[args.length - 1])
        ? args.pop()
        : null;
      rpcclient.rpc(methodname, args, cb);
    }
  }

  function createStreamMethodWrapper(rpcclient, methodname, createStream) {
    return function() {
      // Send RPC methodname and args as the substream meta
      var args = Array.prototype.slice.call(arguments);
      args.unshift(methodname);
      debug.logMX('client, sending streamcall', args);
      return createStream(args);
    };
  }
})();