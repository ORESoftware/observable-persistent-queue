/**
 * Created by oleg on 12/27/16.
 */

const Rx = require('rxjs');

// const obs = Rx.Observable.interval(300);
//
//
// obs.takeLast(3).map(v => v)
//     .subscribe(function(val){
//    console.log(' => val => ', val);
// });

var range = Rx.Observable.range(0, 5);

var source = Rx.Observable.merge(
    range
    // range.skip(1),
    // range.skip(2)
).takeLast(1)

var subscription = source.subscribe(
    function (x) {
        console.log('Next: %s', x);
    },
    function (err) {
        console.log('Error: %s', err);
    },
    function () {
        console.log('Completed');
    });

// var source = Rx.Observable.range(0, 5)
//     .takeLast(1);
//
// var subscription = source.subscribe(
//     function (x) {
//         console.log('Next: ' + x);
//     },
//     function (err) {
//         console.log('Error: ' + err);
//     },
//     function () {
//         console.log('Completed');
//     });



// const q = new Queue();

/*

everytime this.obsEnqueue fires, it does not mean that the dequeueStream() will have an item to send back

so what happens, is that next will fire with an undefined/empty value

instead of next firing with empty data, I want next to fire *only* when a value is actually available

thus, I need to "cancel" the observable from the producer side, because only the producer knows whether the
data exists or not.

*/

// !!!
// we have five observers, imagine only 1 item gets added to the queue, then only ONE next will have data,
// the other 4 will have empty data!

//  q.dequeueStream().subscribe(
//     // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
//     x => console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n'),
//     e => console.log('\n', ' => ' + index + ' error: ', e.stack),
//     () => console.log('\n', ' => ' + index + ' completed')
// );
//
//  q.dequeueStream().subscribe(
//     // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
//     x => console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n'),
//     e => console.log('\n', ' => ' + index + ' error: ', e.stack),
//     () => console.log('\n', ' => ' + index + ' completed')
// );
//
// q.dequeueStream().subscribe(
//     // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
//     x => console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n'),
//     e => console.log('\n', ' => ' + index + ' error: ', e.stack),
//     () => console.log('\n', ' => ' + index + ' completed')
// );
//
// q.dequeueStream().subscribe(
//     // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
//     x => console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n'),
//     e => console.log('\n', ' => ' + index + ' error: ', e.stack),
//     () => console.log('\n', ' => ' + index + ' completed')
// );
//
// q.dequeueStream().subscribe(
//     // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
//     x => console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n'),
//     e => console.log('\n', ' => ' + index + ' error: ', e.stack),
//     () => console.log('\n', ' => ' + index + ' completed')
// );
//
//
// //http://chat.stackoverflow.com/rooms/131652/rx
// //https://jsfiddle.net/p3dxtvsL/
//
//
// function Queue() {
//
//     let index = 0;
//
//     let queue = new Rx.Subject();
//
//     let queueStream = Rx.Observable.create(obs => {
//         var push = Rx.Observer.create(v => {
//             if(index % queue.observers.length == queue.observers.indexOf(push)){
//                 obs.next(v);
//             }
//         });
//         return queue.subscribe(push);
//     });
//
//     this.push = (v) => { queue.next(v); index++; };
//     this.read = () => queueStream;
// }
//
// log = console.log.bind(console);
// queue = new Queue();
//
// queue.read().subscribe(v => log(1, v));
// queue.read().subscribe(v => log(2, v));
//
// queue.push(1);
// queue.push(2);
// queue.push(3);
// queue.push(4);