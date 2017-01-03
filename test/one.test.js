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

process.on('warning', function (w) {
    console.error(w.stack || w);
});

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


// q.readAll().subscribe(
//     x => console.log('\n','next: ', util.inspect(x)),
//     e => console.log('\n','error: ', e.stack),
//     () => console.log('\n','completed')
// );


setTimeout(function () {

    const subs = new Array(3).fill().map(function (item, index) {

        return function a() {

            const pauser = new Rx.Subject();
            const obs = q.dequeueStream();


            obs.subscribe(
                // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
                x => {

                    // pauser.next(false);
                    // obs.dispose();

                    console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n');

                    // setTimeout(function () {
                    //
                    //     pauser.next(true);
                    //
                    // }, 3000);


                },
                e => console.log('\n', ' => ' + index + ' error: ', e.stack),
                () => console.log('\n', ' => ' + index + ' completed')
            );

            pauser.next(true);
            // obs.resume();
        }
    });

    if (false) {

        subs.forEach(function (fn) {

            fn();

        });

    }


}, 1000);


setInterval(function () {

    const c = q.dequeue()
        .subscribe(function(data){
            if(data.error){
                console.error(data.error);
            }
            else if(data){
                console.log(' => add data => ', data);
            }
        });

}, 150);


setInterval(function () {

    const c = q.add('foo bar baz', {isPublish: false})
        .subscribe(function(data){
            if(data.error){
                console.error(data.error);
            }
            else if(data){
                console.log(' => add data => ', data);
            }
    });

}, 150);
