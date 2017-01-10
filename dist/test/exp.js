var Rx = require('rxjs');
var obs = Rx.Observable.interval(1000);
var $obs = obs.takeUntil(Rx.Observable.timer(4000));
$obs.subscribe(function (v) {
    console.log('next => ', v);
}, function (e) {
    console.log('error => ', e);
}, function (c) {
    console.log('complete => ', c);
});
