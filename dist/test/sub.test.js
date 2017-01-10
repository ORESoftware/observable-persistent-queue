var Rx = require('rxjs');
var sub = new Rx.Subject();
var obs = Rx.Observable.create(function ($obs) {
    $obs.next(4);
    return function () {
        console.log('dispose');
    };
});
var s1 = obs.subscribe(function (v) {
    console.log(v);
}, function (e) {
    console.log(e);
}, function () {
    console.log('complete');
});
var s2 = obs.subscribe(function (v) {
    console.log(v);
}, function (e) {
    console.log(e);
}, function () {
    console.log('complete');
});
s1.unsubscribe();
s2.unsubscribe();
