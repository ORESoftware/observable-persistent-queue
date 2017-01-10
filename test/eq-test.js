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


const pauser = new Rx.Subject();
const obs = q.eqStream();

obs.subscribe(
    // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
    v => {

        console.log('\n', ' => next 1: ', util.inspect(v), '\n');

        setTimeout(function () {

            v.cb();

        }, 1000);


    },
    e => console.log('\n', ' => error: ', e.stack),
    () => console.log('\n', ' => completed')
);


obs.subscribe(
    // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
    v => {

        console.log('\n', ' => next 2: ', util.inspect(v), '\n');

        setTimeout(function () {

            v.cb();

        }, 1000);


    },
    e => console.log('\n', ' => error: ', e.stack),
    () => console.log('\n', ' => completed')
);





setInterval(function () {

    const c = q.enq('foo bar baz', {isPublish: false})
        .subscribe(function (data) {
            if (data.error) {
                console.error(data.error);
            }
            else if (data) {
                console.log(' => add data => ', data);
            }
        });

}, 650);
