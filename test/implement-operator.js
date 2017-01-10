const Rx = require('rxjs');


// Rx.Observable.prototype.fit = function (val) {
//
//     const source = this;
//
//     return Rx.Observable.create(function (obs) {
//         // Our disposable is the subscription from the parent
//         return source.subscribe(
//             function (data) {
//                 process.nextTick(function () {
//                     obs.next(data * val);
//                 });
//             },
//             obs.error.bind(obs),
//             obs.complete.bind(obs)
//         );
//     });
// };


Rx.Observable.prototype.fit = function () {

    const source = this;

    return Rx.Observable.create(function (obs) {
        // Our disposable is the subscription from the parent
        return source.subscribe(function(val){
            obs.next(3*val);
        });
    });

};


Rx.Observable.prototype.fnc = function (fn) {

    const source = this;

    return Rx.Observable.create(function (obs) {
        // Our disposable is the subscription from the parent

        return source.subscribe(function(val){
            obs.next(fn.call(obs,val));
        });
    });

};

const obs = Rx.Observable.interval(1000)
    .fnc(function(){
        return Rx.Observable.timer(399);
    })
    .forEach(function (v) {
        console.log(v);
    });