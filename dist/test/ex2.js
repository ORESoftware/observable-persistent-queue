var Rx = require('rxjs');
var obs = Rx.Observable.interval(10)
    .take(10)
    .do(function (val) {
    console.log(val);
});
obs.reduce(function (prev, curr) {
    return prev.concat(curr);
}, [])
    .map(function (val) {
    console.log('val => ', val);
})
    .subscribe();
