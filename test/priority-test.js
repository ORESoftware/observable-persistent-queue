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


function drain() {

    const s = Date.now();
    const obs = q.drain();

    obs.subscribe(
        function (v) {
            console.log('\n','end result => ','\n', v.data);
            setTimeout(function(){
                v.cb();
            }, 20);
        },
        function (e) {

        },
        function () {
            console.log('complete');
            console.log('time => ', Date.now() - s);
        }
    );

    return obs;
}

Rx.Observable.interval(10)
    .take(50)
    .flatMap(function (val) {

        const obs = q.enq('foo bar baz', {
            priority: val,
            isPublish: false
        });

        obs.subscribe(
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

        return obs;


    })
    .reduce(function (prev, curr) {
        return prev.concat(curr);
    },[])
    .flatMap(function () {
        return drain().last()
    })
    .subscribe(
        function (v) {
            console.log(colors.bgYellow('next => '), v);
        },
        function (e) {
            console.error(e);
        },
        function () {
            console.log(colors.bgRed('all done'));
        }
    );




