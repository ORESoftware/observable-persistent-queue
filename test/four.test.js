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


const stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), String(val));
};


// setInterval(function () {
//
    q.enq('zoom')
        .subscribe(
            // x => console.log('\n', ' => dequeue next: \n', util.inspect(x)),
            // e => console.log('\n', ' => dequeue error: ', e.stack),
            // () => console.log('\n', ' => dequeue completed!! ')
        );
//
// }, 1100);


(function doWhile() {

   const c =  q.deq({min: 5, count: 5, wait: true})
        .subscribe(
            x => {
                console.log('\n', colors.bgRed(' 1 => dequeue next: '), '\n', util.inspect(x));
                c.unsubscribe();
                doWhile();
            },
            e => {
                console.log('\n', ' => dequeue error: ', e.stack)
            },
            () => {
                console.log('\n', ' => dequeue completed!! ')
            }
        );

})();



