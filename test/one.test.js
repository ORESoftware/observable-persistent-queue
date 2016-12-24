/**
 * Created by oleg on 12/17/16.
 */


const path = require('path');
const util = require('util');

const Queue = require('../lib/queue');



const q = new Queue({
    filepath: path.resolve(process.env.HOME + '/dogs.js')
});


// q.readAll().subscribe(
//     x => console.log('onNext: %s', util.inspect(x)),
//     e => console.log('onError: %s', e.stack),
//     () => console.log('onCompleted')
// );

function read(){
    process.nextTick(function(){

        q.readUnique().subscribe(
            x =>  { x && console.log('1 onNext: %s', util.inspect(x))},
            e => console.log('1 onError: %s', e.stack),
            () => console.log('1 onCompleted')
        );


        q.readUnique().subscribe(
            x => x && console.log('2 onNext: %s', util.inspect(x)),
            e => console.log('2 onError: %s', e.stack),
            () => console.log('2 onCompleted')
        );

        q.readUnique().subscribe(
            x => x && console.log('3 onNext: %s', util.inspect(x)),
            e => console.log('3 onError: %s', e.stack),
            () => console.log('3 onCompleted')
        );

        q.readUnique().subscribe(
            x => x && console.log('4 onNext: %s', util.inspect(x)),
            e => console.log('4 onError: %s', e.stack),
            () => console.log('4 onCompleted')
        );

        q.readUnique().subscribe(
            x => x && console.log('5 onNext: %s', util.inspect(x)),
            e => console.log('5 onError: %s', e.stack),
            () => console.log('5 onCompleted')
        );
    });

}


var callable = true;

setInterval(function(){

    q.add('foo bar baz').subscribe();

    if(callable){
        callable = false;
        read();
    }

}, 100);



// this.init = function () {
//     if (this.isReady) {
//         return Rx.Observable.empty();
//     }
//     else {
//         return acquireLock(this)
//             .flatMap(() => writeFile(this, ''))
//             .flatMap(() => releaseLock(this))
//             .catch(e => {
//                 console.error(e.stack || e);
//                 return releaseLock(this);
//             }).finally(() => {
//                 this.isReady = true;
//             })
//
//     }
//
// };