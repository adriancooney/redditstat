/**
 * Throttle.js
 *
 * Throttle.js throttles running over a sample
 * to a set rate. A next function is passed. When
 * this function is called, Throttle checks to see
 * if this function is not exceeding the rate, if
 * it is, it waits till the next tick and if it's
 * not it ticks. That was a bad explanation, sorry.
 */

var EventEmitter = require("events").EventEmitter,
	util = require("util");

/**
 * Throttle a function over a sample or int
 * @param {array|int}   sample The array or int to iterate over
 * @param {Function} fn     The function to execute rate iteration
 * @param {int}   rate  The time to wait between iterations
 * @param {int}   repeat The repeat count
 */
var Throttle = function(sample, fn, rate, repeat, callback) {
	if(typeof repeat == "function") callback = repeat, repeat = undefined;

	//Defaults
	if(sample instanceof Array) this.count = sample.length;
	if(typeof sample == "number") this.count = sample;

	this.iteration = 0;
	this.fn = fn;
	this.sample = sample;
	this.rate = rate;
	this.currentRepeat = repeat - 1 || 0;
	this.repeat = this.currentRepeat;
	this.callback = callback;

	//Start the ticker
	this.start();
};

//Inherit the eventEmitter
util.inherits(Throttle, EventEmitter);

/**
 * Start the throttle sequence
 * @return {null} 
 */
Throttle.prototype.start = function() {
	//Resume
	this.running = true;

	//Start ticking
	var that = this;
	(function tick() {
		var value = that.sample instanceof Array ? that.sample[that.iteration] : that.iteration,
			initTime = new Date();

		that.fn(value, function() {
			var now = new Date(),
				diff = now - initTime;

			if(that.iteration < that.count && that.running) next()
			else if(that.currentRepeat) that.currentRepeat--, that.iteration = 0, next();
			else {
				that.emit("done");
				if(that.callback) that.callback(that.iteration);
			}

			function next() {
				if(diff > that.rate) tick();
				else setTimeout(tick, that.rate - diff);
			}

		}, that.iteration, that.count, that.repeat - that.currentRepeat);

		that.iteration++;
	})();
};

/**
 * Restart the throttle sequence
 * @return {null} 
 */
Throttle.prototype.restart = function() {
	this.currentRepeat = this.repeat;
	this.iteration = 0;
	this.start();
};

/**
 * Stop the throttle sequence
 * @return {null} 
 */
Throttle.prototype.stop = function() {
	this.running = false;
};

// new Throttle([1, 2, 3, 4, 5], function(value, next) {
// 	if(value == 1) console.log(1), setTimeout(next, 1500);
// 	else if(value == 2) console.log(2), setTimeout(next, 5000);
// 	else if(value == 3) console.log(3), next();
// 	else console.log(value), next();
// }, 3000, function() {
// 	console.log("Done!");
// });

/**
 * Example usage:
 * Throttle([1, 2, 3, 4, 5, 6], function(value, next) { console.log(value); next(); }, 1000);
 * Throttle(100, function(value, next) { console.log(value); next(); }, 1000/10);
 * Throttle(10, function(value, next) { console.log(value); next(); }, 1000/2, 5);
 */
module.exports = function(sample, fn, rate, repeat) {
	return new Throttle(sample, fn, rate, repeat);
};