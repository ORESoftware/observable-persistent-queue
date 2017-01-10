var Rx = require('rxjs');
var proto = Rx.Observable.prototype;
proto.backpressure = function (fn) {
    var source = this;
    return Rx.Observable.create(function (sub) {
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
//# sourceMappingURL=rxjs-patches.js.map