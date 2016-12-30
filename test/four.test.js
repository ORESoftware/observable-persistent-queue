/**
 * Created by oleg on 12/17/16.
 */


const path = require('path');
const util = require('util');
const fs = require('fs');
const colors = require('colors/safe');

const Queue = require('../lib/queue');

const q = new Queue({
    port: 8888,
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


setInterval(function () {

    q.enq('zoom')
        .subscribe(
            // x => console.log('\n', ' => dequeue next: \n', util.inspect(x)),
            // e => console.log('\n', ' => dequeue error: ', e.stack),
            // () => console.log('\n', ' => dequeue completed!! ')
        );

}, 200);


setInterval(function () {

q.deq({min: 5, count: 5, wait: false})
    .subscribe(
        x => console.log('\n', colors.bgRed(' 1 => dequeue next: '), '\n', util.inspect(x)),
        e => console.log('\n', ' => dequeue error: ', e.stack),
        () => console.log('\n', ' => dequeue completed!! ')
    );

q.deq({min: 3, count: 4, wait: false})
    .subscribe(
        x => console.log('\n', colors.bgRed(' => 2 dequeue next: '), '\n', util.inspect(x)),
        e => console.log('\n', ' => dequeue error: ', e.stack),
        () => console.log('\n', ' => dequeue completed!! ')
    );


//
}, 300);

