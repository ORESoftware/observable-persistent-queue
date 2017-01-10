var Rx = require('rxjs');
var timer = Rx.Observable.interval(300);
var obs = Rx.Observable.create(function ($obs) {
    timer
        .do(function (i) { return console.log('emission: ' + i); })
        .take(10)
        .subscribe($obs);
    return function () {
        console.log('dispose');
    };
});
obs.take(4).subscribe(function (i) { return console.log('outer-emission:' + i); });
