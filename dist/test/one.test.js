'use striiict';
const path = require('path');
const util = require('util');
const fs = require('fs');
const colors = require('colors/safe');
const Rx = require('rxjs');
const Queue = require('../lib/queue');
const q = new Queue({
    port: 8888,
    filepath: path.resolve(process.env.HOME + '/software_testing/dogs.txt')
});
const stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/software_testing/dogs.debug.txt'), String(val));
};
fs.appendFileSync(path.resolve(process.env.HOME + '/software_testing/dogs.debug.txt'), 'beginning of log');
setTimeout(function () {
    const subs = new Array(3).fill().map(function (item, index) {
        return function a() {
            const pauser = new Rx.Subject();
            const obs = q.eqStream();
            obs.subscribe(x => {
                console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n');
            }, e => console.log('\n', ' => ' + index + ' error: ', e.stack), () => console.log('\n', ' => ' + index + ' completed'));
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
    const c = q.dequeue()
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
    const c = q.add('foo bar baz', { isPublish: false })
        .subscribe(function (data) {
        if (data.error) {
            console.error(data.error);
        }
        else if (data) {
            console.log(' => add data => ', data);
        }
    });
}, 150);
