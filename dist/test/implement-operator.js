var Rx = require('rxjs');
Rx.Observable.prototype.fit = function () {
    var source = this;
    return Rx.Observable.create(function (obs) {
        return source.subscribe(function (val) {
            obs.next(3 * val);
        });
    });
};
Rx.Observable.prototype.fnc = function (fn) {
    var source = this;
    return Rx.Observable.create(function (obs) {
        return source.subscribe(function (val) {
            obs.next(fn.call(obs, val));
        });
    });
};
var obs = Rx.Observable.interval(1000)
    .fnc(function () {
    return Rx.Observable.timer(399);
})
    .forEach(function (v) {
    console.log(v);
});
