'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require("util");
var Rx_1 = require("rxjs/Rx");
var proto = Rx_1.Observable.prototype;
proto.backpressure = function (fn) {
    var source = this;
    return Rx_1.Observable.create(function (sub) {
        return source.subscribe(function onNext(val) {
            fn.call(sub, val.data, function (err, data) {
                if (err) {
                    return sub.error(err);
                }
                console.log(util.inspect(val));
                process.nextTick(val.cb.bind(val));
                sub.next(data);
            });
        }, function onError(e) {
            sub.error(e);
        }, function onComplete() {
            sub.complete();
        });
    });
};
