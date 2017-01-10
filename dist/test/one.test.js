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
setTimeout(function () {
    var subs = new Array(3).fill().map(function (item, index) {
        return function a() {
            var pauser = new Rx.Subject();
            var obs = q.eqStream();
            obs.subscribe(function (x) {
                console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n');
            }, function (e) { return console.log('\n', ' => ' + index + ' error: ', e.stack); }, function () { return console.log('\n', ' => ' + index + ' completed'); });
            pauser.next(true);
        };
    });
    if (false) {
        subs.forEach(function (fn) {
            fn();
        });
    }
}, 1000);
setInterval(function () {
    var c = q.dequeue()
        .subscribe(function (data) {
        if (data.error) {
            console.error(data.error);
        }
        else if (data) {
            console.log(' => add data => ', data);
        }
    });
}, 150);
setInterval(function () {
    var c = q.add('foo bar baz', { isPublish: false })
        .subscribe(function (data) {
        if (data.error) {
            console.error(data.error);
        }
        else if (data) {
            console.log(' => add data => ', data);
        }
    });
}, 150);
