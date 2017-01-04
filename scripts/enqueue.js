/**
 * Created by oleg on 12/17/16.
 */


const path = require('path');
const util = require('util');
const fs = require('fs');
const colors = require('colors/safe');

const Queue = require('../lib/queue');

const q = new Queue({
    port: 9950,
    filepath: path.resolve(process.env.HOME + '/dogs.txt')
});



const stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/dogs.debug.txt'), String(val));
};


    q.enq('zoom')
        .subscribe(
            x => {
                console.log('\n', ' => dequeue next: \n', util.inspect(x))
                process.exit(0);
            },
            e => console.log('\n', ' => dequeue error: ', e.stack),
            () => console.log('\n', ' => dequeue completed!! ')
        );


