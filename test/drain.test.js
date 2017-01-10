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
    filepath: path.resolve(process.env.HOME + '/software_testing/dogs.txt')
});


const stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/software_testing/dogs.debug.txt'), String(val));
};


fs.appendFileSync(path.resolve(process.env.HOME + '/software_testing/dogs.debug.txt'), 'beginning of log');


let obs = new Rx.Subject();
// obs = obs.takeUntil(q.isEmpty(obs));

q.drain(obs).subscribe(

    function (v) {

        console.log('end result => ', colors.yellow(util.inspect(v)));

        setTimeout(function () {
            obs.next();
        }, 1000);

    },
    function (e) {
        console.log('on error => ', e);
    },
    function (c) {
        console.log(colors.red(' DRAIN on completed => '), c);
    }

);

obs.subscribe(
    function (v) {
        console.log('next item that was drained => ', v);
    },
    function (e) {
        console.log('on error => ', e);
    },
    function (c) {
        console.log(colors.red(' => obs on completed => '), c);
    }
);

// obs.next();


// [1, 2, 3].forEach(function () {
//
//     q.enq('foo bar baz', {isPublish: false})
//         .subscribe(function (data) {
//             if (data) {
//                 console.log(' => add data => ', data);
//             }
//         });
//
// });


