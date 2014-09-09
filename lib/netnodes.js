var http     = require('http')
var pull     = require('pull-stream')
var pl       = require('pull-level')
var toStream = require('pull-stream-to-stream')
var debug    = require('./debug')

exports._setup = function(opts) {
  this.netNodesDB = this.db.sublevel('netnodes', { valueEncoding: 'json' })
  this.networkDB = this.db.sublevel('network', { valueEncoding: 'json' })
  this.netState = { lastSync: null }
  this.networkDB.get('sync-state', function(err, state) {
    if (state)
      this.netState = state
  }.bind(this))
}

exports.getSyncState = function(cb) {
  this.networkDB.get('sync-state', function(err, state) {
    if (err) {
      if (!err.notFound) return cb(err)
      state = { lastSync: null }
    }
    cb(null, state)
  })
}

exports.getNodes = function(cb) {
  pull(
    pl.read(this.netNodesDB, { keys: true, values: false }),
    pull.collect(function(err, nodes) {
      if (err) return cb(err);
      cb(null, nodes);
    })
  )
};

exports.getNode = function(addr, port, cb) {
  this.netNodesDB.get([addr, port], cb);
};

exports.addNode = function(addr, port, cb) {
  this.netNodesDB.put([addr, +port], [], cb);
};

exports.addNodes = function(nodes, cb) {
  if (!nodes || !Array.isArray(nodes) || nodes.length == 0)
    cb(new Error('Must give an array of nodes'))

  var n = 0
  nodes.forEach(function(node) {
    // If a string of 'addr:port', split into [addr, port]
    if (typeof node == 'string')
      node = node.split(':')
    // If no port was given, default to 64000
    if (node.length == 1)
      node[1] = 64000

    this.netNodesDB.put([node[0], +node[1]], [], function(err) {
      if (err) return n = -1, cb(err)
      if (++n == nodes.length) cb()
    });
  }.bind(this))
};

exports.delNode = function(addr, port, cb) {
  this.netNodesDB.del([addr, +port], cb);
};

exports.syncNetwork = function(opts, cb) {
  if (!cb) {
    cb = opts
    opts = {}
  }

  // Do nothing if synced recently enough
  if (opts.ifOlderThan && this.netState.lastSync && (+(new Date()) - this.netState.lastSync) < opts.ifOlderThan)
    return cb(null, {})

  // Update net state
  this.netState.lastSync = +(new Date())
  this.networkDB.put('sync-state', this.netState)

  var m = 0, n = 0;
  // Establish connections
  pull(
    pl.read(this.netNodesDB, { keys: true, values: false }),
    pull.collect(function(err, nodes) {
      if (err) return cb(err);
      if (nodes.length === 0) return cb();
      debug.logSync('Syncing',nodes.length,'nodes')
      nodes.forEach(connectOut);
    })
  )

  var localSsb = this.ssb
  var results = {}
  function connectOut(host) {
    var startTs = +(new Date());
    var name = host[0] + ':' + host[1];
    debug.logSync(name + ' connecting.');
    n++;

    var req = http.request({ method: 'CONNECT', hostname: host[0], port: host[1], path: '/' });
    req.on('connect', function(res, conn, head) {
      debug.logSync(name + ' syncing.');

      // Create RPC connection
      var rpcConn = require('../').client();
      rpcConn.pipe(conn).pipe(rpcConn);

      // Run replication
      var rsRemote = rpcConn.api.createReplicationStream()
      rsRemote.pipe(toStream(localSsb.createReplicationStream(function(err) {
        conn.end()
        if (err) results[name] = { error: err, msg: err.toString() };
        else {
          results[name] = { elapsed: (+(new Date()) - startTs) }
          debug.logSync(name + ' synced. (' + results[name].elapsed + 'ms)');
        }
        if (++m == n) cb(null, results);
      }))).pipe(rsRemote);
      // :TODO: spit out some metrics, like # of new messages
    });
    req.on('error', function(e) {
      debug.logSync(name + ' failed, ' + e.message);
      results[name] = { error: e, msg: e.message }
      if (++m == n) cb(null, results)
    });
    req.setTimeout(opts.timeout || 3000, function() {
      req.abort()
    })
    req.end();
  }
}