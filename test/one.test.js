/**
 * Created by oleg on 12/17/16.
 */


const path = require('path');
const util = require('util');
const fs = require('fs');
const colors = require('colors/safe');
const Rx = require('rx-lite');

const Queue = require('../lib/queue');

process.on('warning', function (w) {
    console.error(w.stack || w);
});

const q = new Queue({
    filepath: path.resolve(process.env.HOME + '/dogs.txt')
});


// fs.writeFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), '');

const stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), String(val));
};


fs.appendFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), 'beginning of log');


// q.readAll().subscribe(
//     x => console.log('\n','onNext: ', util.inspect(x)),
//     e => console.log('\n','onError: ', e.stack),
//     () => console.log('\n','onCompleted')
// );


setTimeout(function () {

    const subs = new Array(2).fill().map(function (item, index) {

        return function a() {

            const pauser = new Rx.Subject();
            const obs = q.dequeueStream(pauser);


            obs.subscribe(
                // x =>  { x && console.log('\n','1 onNext: ', util.inspect(x),'\n')},
                x => {

                    // pauser.onNext(false);
                    // obs.dispose();

                    console.log('\n', ' => ' + index + ' onNext: ', util.inspect(x), '\n');

                    // setTimeout(function () {
                    //
                    //     pauser.onNext(true);
                    //
                    // }, 3000);


                },
                e => console.log('\n', ' => ' + index + ' onError: ', e.stack),
                () => console.log('\n', ' => ' + index + ' onCompleted')
            );

            pauser.onNext(true);
            // obs.resume();
        }
    });

    if (true) {

        subs.forEach(function (fn) {

            fn();

        });

    }


}, 1000);


// setInterval(function () {
//
//     const c = q.add('foo bar baz', {isPublish: false}).subscribe();
//
// }, 50);
