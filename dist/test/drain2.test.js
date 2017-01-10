'use striiict';
var path = require('path');
var util = require('util');
var fs = require('fs');
var colors = require('colors/safe');
var Rx = require('rxjs');
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
fs.appendFileSync(path.resolve(process.env.HOME + '/software_testing/dogs.debug.txt'), 'beginning of log');
q.drain()
    .subscribe(function (v) {
    console.log(' MF end result => ', colors.blue(util.inspect(v)));
    setTimeout(function () {
        v.cb();
    }, 100);
}, function (e) {
    console.log('on error => ', e);
}, function () {
    console.log(colors.green(' DRAIN on completed '));
});
