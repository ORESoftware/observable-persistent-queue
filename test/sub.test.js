/**
 * Created by oleg on 1/5/17.
 */


const Rx = require('rxjs');

const sub = new Rx.Subject();


const obs = Rx.Observable.create($obs => {

    $obs.next(4);

     // sub.subscribe($obs);

    return function(){
        console.log('dispose');
    }

});


const s1 = obs.subscribe(
    function (v) {
        console.log(v);
    },
    function (e) {
        console.log(e);
    },
    function () {
        console.log('complete');
    }
);

const s2 = obs.subscribe(
    function (v) {
        console.log(v);
    },
    function (e) {
        console.log(e);
    },
    function () {
        console.log('complete');
    }
);


s1.unsubscribe();
s2.unsubscribe();


