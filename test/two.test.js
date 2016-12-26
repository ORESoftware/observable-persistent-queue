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

        q.readUnique().subscribe(
            x => x && console.log('\n','1 onNext: ', util.inspect(x)),
            e => console.log('\n','1 onError:', e.stack),
            () => console.log('\n','1 onCompleted')
        );

        q.readUnique().subscribe(
            x => x && console.log('\n','2 onNext: ', util.inspect(x)),
            e => console.log('\n','2 onError: ', e.stack),
            () => console.log('\n','2 onCompleted')
        );

        q.readUnique().subscribe(
            x => x && console.log('\n','3 onNext:', util.inspect(x)),
            e => console.log('\n','3 onError:', e.stack),
            () => console.log('\n','3 onCompleted')
        );

        q.readUnique().subscribe(
            x => x && console.log('\n','4 onNext:', util.inspect(x)),
            e => console.log('\n','4 onError: ', e.stack),
            () => console.log('\n','4 onCompleted')
        );

        q.readUnique().subscribe(
            x => x && console.log('\n','5 onNext:', util.inspect(x)),
            e => console.log('\n','5 onError:', e.stack),
            () => console.log('\n','5 onCompleted')
        );
    }, 3000);

}


read();

setInterval(function () {

    q.dequeue().subscribe(
        x => console.log('\n',' => dequeue onNext: ', util.inspect(x)),
        e => console.log('\n',' => dequeue onError: ', e.stack),
        () => console.log('\n',' => dequeue onCompleted!! ')
    );

}, 300);

