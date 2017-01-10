var Rx = require('rxjs');
var obs = Rx.Observable.interval(100)
    .take(3)
    .reduce(function (prev, curr) {
    return prev.concat(curr);
}, [])
    .do(function (val) {
    console.log(val);
})
    .subscribe();
