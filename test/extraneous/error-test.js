/**
 * Created by oleg on 1/13/17.
 */


const Rx = require('rxjs/Rx');

Rx.Observable.from([1,2,3,4])
.filter(function(i){
    return i < 4;
})
.subscribe(
    function onNext(v) {
        console.log('next => ', v);
    },
    function onError(e) {
        throw e;
    },
    function onComplete() {
        console.log('complete');
    }
);