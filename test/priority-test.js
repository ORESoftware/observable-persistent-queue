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

const q = new Queue({
    port: 8888,
    filepath: path.resolve(process.env.HOME + '/dogs.txt'),
    priority: {
        first: 20,
        levels: [
            {
                level: 3, cycles: 5
            },
            {
                level: 4, cycles: 7
            },
            {
                level: 2, cycles: 3
            },
            {
                level: 1, cycles: 2
            }
        ]
    }
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
    });

    obs.subscribe(function (v) {
        console.log('\n\n','next item that was drained => ', v,'\n\n');
    });


}, 3000);


new Array(40).fill().forEach(function () {

    const r = Math.floor(Math.random()*5);

    console.log('\n', ' => random => ', r,'\n');

    q.add('foo bar baz', {
        priority: r,
        isPublish: false
    })
        .subscribe(function (data) {
            if (data) {
                // console.log(' => add data => ', data);
            }
        });


});


