
const Rx = require('rxjs');

var example = Rx.Observable.of(
    Rx.Observable.timer(1),
    Rx.Observable.timer(1),
    Rx.Observable.timer(1)
);

console.log(example.constructor.name);

var example = Rx.Observable.of([
        Rx.Observable.timer(1),
        Rx.Observable.timer(1),
        Rx.Observable.timer(1)
    ]);

console.log(example.constructor.name);


var example = Rx.Observable.merge(
    Rx.Observable.timer(1),
    Rx.Observable.timer(1),
    Rx.Observable.timer(1)
);

console.log(example.constructor.name);

var example = Rx.Observable.merge([
    Rx.Observable.timer(1),
    Rx.Observable.timer(1),
    Rx.Observable.timer(1)
]);

console.log(example.constructor.name);