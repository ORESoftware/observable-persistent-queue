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
var async = require('async');
async.whilst(function () {
    return true;
}, function (cb) {
    q.enq(['zoom', 'bar', 'baz'], {
        controlled: true
    }).subscribe(function (x) {
        console.log('\n', ' => add next: \n', util.inspect(x));
    }, function (e) {
        console.log('\n', ' => dequeue error: ', e.stack);
        cb(e);
    }, function () { return console.log('\n', ' => dequeue completed!! '); });
}, function (err, n) {
    if (err) {
        throw err;
    }
});
