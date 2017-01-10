/**
 * Created by oleg on 1/7/17.
 */


const Rx = require('rxjs');


const obs = Rx.Observable.interval(10)
    .take(10)
    .do(function (val) {
        console.log(val);
    });

obs.reduce(function (prev, curr) {
    return prev.concat(curr)
}, [])
    .map(function(val){
        console.log('val => ', val);
    })
    .subscribe();

// obs.subscribe(
//     null,
//     null,
//     function () {
//         console.log('complete');
//     }
// );