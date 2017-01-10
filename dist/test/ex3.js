var Rx = require('rxjs');
var i = 0;
var obs = Rx.Observable.interval(10)
    .take(10)
    .map(function () { return i++; })
    .map(function (val) {
    return Rx.Observable.create(function (obs) {
        obs.next(val);
    });
})
    .groupBy(function () {
    return true;
})
    .flatMap(function (val) {
    return val.concat();
})
    .do(function (val) {
    console.log('val => ', val);
})
    .last(function (val) {
    return val.flatMap(function (val) {
        return val;
    });
});
obs.subscribe(function (v) {
    console.log('\n next (and only) result => \n', v);
});
