exports.logging = { mx: false };

exports.logMX = function() {
	if (!exports.logging.mx) return;
	var args = Array.prototype.slice.call(arguments);
	args.unshift('MX');
	console.log.apply(console, args);
};