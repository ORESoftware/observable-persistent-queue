'use strict';
const Rx = require("rxjs");
const proto = Rx.Observable.prototype;
proto.backpressure = function (fn) {
    const source = this;
    return Rx.Observable.create(sub => {
        return source.subscribe(function onNext(val) {
            fn.call(sub, val.data, function (err, data) {
                if (err) {
                    sub.error(err);
                }
                else {
                    val.cb();
                    sub.next(data);
                }
            });
        }, function onError(e) {
            sub.error(e);
        }, function onComplete() {
            sub.complete();
        });
    });
};
