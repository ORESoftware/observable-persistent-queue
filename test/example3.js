
const Rx = require('rxjs');

let svc = Rx.Observable.interval(100)
    .map(function ( index ) {
        let arr = [];
        for ( let i = 0; i < timerArrLength [ index ]; i++ ) {
            arr.push ( Rx.Observable.timer ( 1000 ) );
        }
        return arr;
    });


svc.subscribe(
    function onNext(v){
        console.log('=> v =>',v);
    },
    function onError(e){
        console.error(e);
    },
    function onComplete(){
        console.log('complete');
    }
);