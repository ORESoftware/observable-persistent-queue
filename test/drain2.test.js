'use striiict';

//core
const path = require('path');
const util = require('util');
const fs = require('fs');

//npm
const colors = require('colors/safe');
const Rx = require('rxjs');

//project
const Queue = require('../lib/queue');


const q = new Queue({
    port: 8888,
    filepath: path.resolve(process.env.HOME + '/dogs.txt')
});


// fs.writeFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), '');

const stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), String(val));
};


fs.appendFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), 'beginning of log');


q.drain()
    .subscribe(
        function (v) {

            console.log(' MF end result => ', colors.blue(util.inspect(v)));
            setTimeout(function () {
                v.cb();
            }, 100);

        },
        function (e) {
            console.log('on error => ', e);
        },
        function () {
            console.log(colors.green(' DRAIN on completed '));
        }
    );



