var path = require('path');
var util = require('util');
var fs = require('fs');
var colors = require('colors/safe');
var Queue = require('../lib/queue');
var q = new Queue({
    port: 8888,
    filepath: path.resolve(process.env.HOME + '/software_testing/dogs.txt')
});
var stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/software_testing/dogs.debug.txt'), String(val));
};
setInterval(function () {
    q.enq('zoom');
}, 3000);
var c = q.deq({ min: 5, count: 5, wait: true })
    .subscribe(function (v) {
    console.log('\n', colors.green(' => zzz dequeue next: '), '\n', util.inspect(v));
}, function (e) {
    console.log('\n', ' => zzz dequeue error: ', e.stack);
}, function () {
    console.log('\n', colors.bgRed(' => zzz dequeue completed!! '));
});
