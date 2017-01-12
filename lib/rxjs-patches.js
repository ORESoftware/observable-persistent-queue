'use strict';
const util = require("util");
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
                    console.log(util.inspect(val));
                    process.nextTick(val.cb.bind(val));
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
