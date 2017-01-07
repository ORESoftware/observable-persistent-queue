/**
 * Created by oleg on 1/5/17.
 */


const Rx = require('rxjs');


const timer = Rx.Observable.interval(300);

const obs = Rx.Observable.create($obs => {

    timer
        .do(i => console.log('emission: ' + i))
        .take(10)
        .subscribe($obs);

    return function(){
        console.log('dispose')
    }
});


obs.take(4).subscribe(i => console.log('outer-emission:' + i));


// const timer = Rx.Observable.interval(300);
//
// const obs = Rx.Observable.create($obs => {
//
//         timer.do(i => console.log('emission: ' + i))
//         .take(10)
//         .subscribe(
//             val => $obs.next(val),
//             err => $obs.error(err),
//             () => $obs.complete()
//         );
//
//     // return function(){}; // empty unsubscribe function, internal subscription will keep on running
// });
//
//
// obs.take(4).subscribe(i => console.log('outer-emission:'+i))