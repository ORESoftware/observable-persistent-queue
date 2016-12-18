/**
 * Created by oleg on 12/17/16.
 */


const path = require('path');
const util = require('util');

const Queue = require('../lib/queue');

const q = new Queue({
    filepath: path.resolve(process.env.HOME + '/dogs.js')
});


q.read().subscribe(
    x => console.log('onNext: %s', util.inspect(x)),
    e => console.log('onError: %s', e.stack),
    () => console.log('onCompleted')
);

setInterval(function(){

    q.add('foo bar baz').subscribe()

}, 1000);



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