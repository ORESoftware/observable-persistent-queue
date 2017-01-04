/**
 * Created by oleg on 1/3/17.
 */


const Rx = require('rxjs');

const obs = Rx.Observable.interval(1000);
const $obs = obs.takeUntil(Rx.Observable.timer(4000));

$obs.subscribe(
    function (v) {
        console.log('next => ', v);
    },
    function (e) {
        console.log('error => ', e);
    },
    function (c) {
        console.log('complete => ', c);
    }
);