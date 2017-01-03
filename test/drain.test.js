'use striiict'

//core
const path = require('path');
const util = require('util');
const fs = require('fs');

//npm
const colors = require('colors/safe');
const Rx = require('rxjs');

//project
const Queue = require('../lib/queue');

process.on('warning', function (w) {
    console.error(w.stack || w);
});

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


setTimeout(function () {

    const obs = new Rx.Subject();

    q.drain(obs).subscribe(function (v) {
        console.log('end result => ', v);
        // obs.next();
    });

    obs.subscribe(function (v) {
        console.log('next item that was drained => ', v);
    });

    obs.next('charlie');

}, 1000);


[1, 2, 3].forEach(function () {

    q.add('foo bar baz', {isPublish: false})
        .subscribe(function (data) {
            if (data) {
                console.log(' => add data => ', data);
            }
        });


});


