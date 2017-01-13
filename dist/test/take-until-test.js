'use strict';
const Rx = require('rxjs');
let countIn = 0;
let countOut = 0;
function makeTimerIn() {
    return Rx.Observable.timer(50)
        .do(function () {
        countIn++;
        console.log(' => Count in => ', countIn);
    });
}
function makeTimerOut() {
    return Rx.Observable.timer(50)
        .do(function () {
        countOut++;
        console.log(' => Count out => ', countOut);
    });
}
function makeTimerUntil() {
    const r = Math.ceil(Math.random() * 1500);
    return Rx.Observable.timer(r);
}
Rx.Observable.interval(30)
    .flatMap(() => {
    return makeTimerIn();
})
    .flatMap(() => {
    return makeTimerOut();
})
    .takeUntil(makeTimerUntil())
    .subscribe(function (v) {
    console.log('v => ', v);
}, function (e) {
    console.error(' => error => ', e);
}, function () {
    console.log('in => ', countIn);
    console.log('out => ', countOut);
});
