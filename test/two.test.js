/**
 * Created by oleg on 12/17/16.
 */


const path = require('path');
const util = require('util');
const fs = require('fs');

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

function read() {

    setTimeout(function () {

        const subs = new Array(5).fill().map(function (item, index) {

            return function () {
                const obs = q.eqStream();

                return obs.subscribe(
                    // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
                    x => console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n'),
                    e => console.log('\n', ' => ' + index + ' error: ', e.stack),
                    () => console.log('\n', ' => ' + index + ' completed')
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

    q.dequeue()
        .subscribe(
        x => console.log('\n', ' => dequeue next: \n', util.inspect(x)),
        e => console.log('\n', ' => dequeue error: ', e.stack),
        () => console.log('\n', ' => dequeue completed!! ')
    );

}, 300);

