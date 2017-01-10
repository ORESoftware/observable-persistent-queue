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
var obs = new Rx.Subject();
q.drain(obs).subscribe(function (v) {
    console.log('end result => ', colors.yellow(util.inspect(v)));
    setTimeout(function () {
        obs.next();
    }, 1000);
}, function (e) {
    console.log('on error => ', e);
}, function (c) {
    console.log(colors.red(' DRAIN on completed => '), c);
});
obs.subscribe(function (v) {
    console.log('next item that was drained => ', v);
}, function (e) {
    console.log('on error => ', e);
}, function (c) {
    console.log(colors.red(' => obs on completed => '), c);
});
