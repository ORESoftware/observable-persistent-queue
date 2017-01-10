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
var pauser = new Rx.Subject();
var obs = q.eqStream();
obs.subscribe(function (v) {
    console.log('\n', ' => next 1: ', util.inspect(v), '\n');
    setTimeout(function () {
        v.cb();
    }, 1000);
}, function (e) { return console.log('\n', ' => error: ', e.stack); }, function () { return console.log('\n', ' => completed'); });
obs.subscribe(function (v) {
    console.log('\n', ' => next 2: ', util.inspect(v), '\n');
    setTimeout(function () {
        v.cb();
    }, 1000);
}, function (e) { return console.log('\n', ' => error: ', e.stack); }, function () { return console.log('\n', ' => completed'); });
setInterval(function () {
    var c = q.enq('foo bar baz', { isPublish: false })
        .subscribe(function (data) {
        if (data.error) {
            console.error(data.error);
        }
        else if (data) {
            console.log(' => add data => ', data);
        }
    });
}, 650);
