/**
 * Created by oleg on 12/17/16.
 */


const path = require('path');
const util = require('util');
const fs = require('fs');

const Queue = require('../lib/queue');

const q = new Queue({
    filepath: path.resolve(process.env.HOME + '/dogs.txt')
});


process.on('warning', function (w) {
    console.error(w.stack || w);
});

const stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), String(val));
};

function read() {

    setTimeout(function () {

        const subs = new Array(5).fill().map(function (item, index) {

            return function () {
                const obs = q.dequeueStream();
                obs.resume();
                return obs.subscribe(
                    // x =>  { x && console.log('\n','1 onNext: ', util.inspect(x),'\n')},
                    x => console.log('\n', ' => ' + index + ' onNext: ', util.inspect(x), '\n'),
                    e => console.log('\n', ' => ' + index + ' onError: ', e.stack),
                    () => console.log('\n', ' => ' + index + ' onCompleted')
                );
            }
        });

        if (true) {

            subs.forEach(function (fn) {

                fn();

            });

        }
    }, 3000);

}


read();

setInterval(function () {

    q.dequeue().subscribe(
        x => console.log('\n', ' => dequeue onNext: ', util.inspect(x)),
        e => console.log('\n', ' => dequeue onError: ', e.stack),
        () => console.log('\n', ' => dequeue onCompleted!! ')
    );

}, 200);

