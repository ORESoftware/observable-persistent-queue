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
    filepath: path.resolve(process.env.HOME + '/dogs.txt')
});


// fs.writeFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), '');

const stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), String(val));
};


fs.appendFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), 'beginning of log');


const pauser = new Rx.Subject();
const obs = q.eqStream(pauser);

obs.subscribe(
    // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
    x => {

        console.log('\n', ' => next: ', util.inspect(x), '\n');

        setTimeout(function () {

            pauser.next();

        }, 1000);


    },
    e => console.log('\n', ' => error: ', e.stack),
    () => console.log('\n', ' => completed')
);

pauser.next(true);




setInterval(function () {

    const c = q.add('foo bar baz', {isPublish: false})
        .subscribe(function (data) {
            if (data.error) {
                console.error(data.error);
            }
            else if (data) {
                console.log(' => add data => ', data);
            }
        });

}, 650);
