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


    q.drain().subscribe(function (v) {
        console.log('end result => ', v.data);

        setTimeout(function(){
            v.cb();
        },1000);
    });




}, 3000);


new Array(40).fill().forEach(function () {

    const r = Math.floor(Math.random() * 5);

    console.log('\n', ' => random => ', r, '\n');

    q.enq('foo bar baz', {
        priority: r,
        isPublish: false
    }).subscribe(
            function onNext(data) {
                if (data) {
                    console.log(' => add data => ', data);
                }
            },
            function onError(e) {
                console.error(e.stack || e);
            },
            function onComplete() {
                console.log('complete.');
            }
        );


});


