/**
 * Created by oleg on 1/13/17.
 */


const Rx = require('rxjs/Rx');

process.on('uncaughtException', function(e){
    console.error(' => uncaught exception => ', e.stack || e);
});


Rx.Observable.timer(100)
    .flatMap(() => {
        throw 'chuck';
    })
    .subscribe(
        function onNext() {

        },
        function onError(e) {
            throw new Error('holodays' + (e.stack || e));
        },
        function onComplete() {

        }
    );