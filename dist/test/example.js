'use striiict';
var Rx = require('rxjs');
var obs = Rx.Observable.interval(100)
    .take(5)
    .map(function (v) {
    console.log(v);
    return v;
})
    .reduce(function (prev, curr) {
    return prev.concat(curr);
}, [])
    .last(function (results) {
    console.log('results => ', results);
    return results;
});
obs.subscribe();
