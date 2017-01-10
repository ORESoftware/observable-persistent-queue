var Rx = require('rxjs');
var example = Rx.Observable.interval(1000)
    .map(function (val) { return Rx.Observable.of(val + 10); })
    .concatAll();
example.subscribe(function (val) { return console.log('Example with Basic Observable:', val); });
