var debug = require('./debug')
exports.manifest = {
  methods: {
    getSyncState: { type: 'async' },
    getNodes:     { type: 'async' },
    getNode:      { type: 'async' },
    addNode:      { type: 'async' },
    addNodes:     { type: 'async' },
    delNode:      { type: 'async' },
    syncNetwork:  { type: 'async' }
  }
}
exports.instance = function(opts, db, ssb) {
  var netnodes = {}
  var netState = { lastSync: null }

  // load dependencies (cant be toplevel or clients in the browser fail to run)
  var http     = require('http')
  var pull     = require('pull-stream')
  var pl       = require('pull-level')
  var toStream = require('pull-stream-to-stream')

  // setup db and load state
  var netNodesDB = db.sublevel('netnodes', { valueEncoding: 'json' })
  var networkDB = db.sublevel('network', { valueEncoding: 'json' })
  networkDB.get('sync-state', function(err, state) {
    if (state)
      netState.lastSync = state.lastSync
  })

  netnodes.getSyncState = function(cb) {
    networkDB.get('sync-state', function(err, state) {
      if (err) {
        if (!err.notFound) return cb(err)
        state = { lastSync: null }
      }
      cb(null, state)
    })
  }

  netnodes.getNodes = function(cb) {
    pull(
      pl.read(netNodesDB, { keys: true, values: false }),
      pull.collect(function(err, nodes) {
        if (err) return cb(err)
        cb(null, nodes)
      })
    )
  }

  netnodes.getNode = function(addr, port, cb) {
    netNodesDB.get([addr, port], cb)
  }

  netnodes.addNode = function(addr, port, cb) {
    netNodesDB.put([addr, +port], [], cb)
  }

  netnodes.addNodes = function(nodes, cb) {
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

      netNodesDB.put([node[0], +node[1]], [], function(err) {
        if (err) return n = -1, cb(err)
        if (++n == nodes.length) cb()
      })
    })
  }

  netnodes.delNode = function(addr, port, cb) {
    netNodesDB.del([addr, +port], cb)
  }

  netnodes.syncNetwork = function(opts, cb) {
    if (!cb) {
      cb = opts
      opts = {}
    }

    // Do nothing if synced recently enough
    if (opts.ifOlderThan && netState.lastSync && (+(new Date()) - netState.lastSync) < opts.ifOlderThan)
      return cb(null, {})

    // Update net state
    netState.lastSync = +(new Date())
    networkDB.put('sync-state', netState)

    var m = 0, n = 0;
    // Establish connections
    pull(
      pl.read(netNodesDB, { keys: true, values: false }),
      pull.collect(function(err, nodes) {
        if (err) return cb(err)
        if (nodes.length === 0) return cb(null, {})
        debug.logSync('Syncing',nodes.length,'nodes')
        nodes.forEach(connectOut)
      })
    )

    var results = {}
    function connectOut(host) {
      var startTs = +(new Date())
      var name = host[0] + ':' + host[1]
      debug.logSync(name + ' connecting.')
      n++

      var req = http.request({ method: 'CONNECT', hostname: host[0], port: host[1], path: '/' })
      req.on('connect', function(res, conn, head) {
        debug.logSync(name + ' syncing.')

        // Create RPC connection
        var rpcConn = require('../').client()
        rpcConn.pipe(conn).pipe(rpcConn)

        // Run replication
        var rsRemote = rpcConn.api.createReplicationStream()
        rsRemote.pipe(toStream(ssb.internalInst.createReplicationStream(function(err) {
          conn.end()
          if (err) results[name] = { error: err, msg: err.toString() }
          else {
            results[name] = { elapsed: (+(new Date()) - startTs) }
            debug.logSync(name + ' synced. (' + results[name].elapsed + 'ms)');
          }
          if (++m == n) cb(null, results)
        }))).pipe(rsRemote)
        // :TODO: spit out some metrics, like # of new messages
      });
      req.on('error', function(e) {
        debug.logSync(name + ' failed, ' + e.message)
        results[name] = { error: e, msg: e.message }
        if (++m == n) cb(null, results)
      })
      req.setTimeout(opts.timeout || 3000, function() {
        req.abort()
      })
      req.end()
    }
  }

  return netnodes
}