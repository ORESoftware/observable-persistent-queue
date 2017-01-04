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

const async = require('async');


async.whilst(
    function () {
        return true;
    },
    function (cb) {

        q.enq(['zoom', 'bar', 'baz'], {

            controlled: true

        }).subscribe(
                function (x) {
                    console.log('\n', ' => add next: \n', util.inspect(x));
                    // cb();
                },
                function (e) {
                    console.log('\n', ' => dequeue error: ', e.stack);
                    cb(e);
                },
                () => console.log('\n', ' => dequeue completed!! ')
            )


    },
    function (err, n) {
        // 5 seconds have passed, n = 5
        if (err) {
            throw err;
        }

    }
);



