exports.logging = { mx: false, sync: false }

exports.logMX = function() {
  if (!exports.logging.mx) return
  var args = Array.prototype.slice.call(arguments)
  args.unshift('MX')
  console.log.apply(console, args)
}

exports.logSync = function() {
  if (!exports.logging.sync) return
  var args = Array.prototype.slice.call(arguments)
  args.unshift('SYNC')
  console.log.apply(console, args)
}