'use strict';


const Rx = require('rxjs');


let countIn = 0;
let countOut = 0;

const p = Rx.Observable.prototype;

p.makeTimerIn = function () {

    const source = this;

    return Rx.Observable.create(sub => {

        return source.subscribe(
            function(){
                setTimeout(function(){
                    countIn++;
                    console.log(' => Count in => ', countIn);
                    sub.next();
                }, 50);
            }
        )

    });

};

p.makeTimerOut = function() {

    const source = this;

    return Rx.Observable.create(sub => {

        return source.subscribe(
            function(){
                setTimeout(function(){
                    countOut++;
                    console.log(' => Count out => ', countOut);
                    sub.next();
                }, 50);
            }
        )

    });

};



function makeTimerUntil() {

    const r = Math.ceil(Math.random() * 500);
    return Rx.Observable.timer(r);

}


Rx.Observable.interval(30)
    .makeTimerIn()
    .makeTimerOut()
    .takeUntil(makeTimerUntil())
    .subscribe(function (v) {
        console.log('v => ', v);
    }, function (e) {
        console.error(' => error => ', e);
    }, function () {
        console.log('=> final in => ', countIn);
        console.log('=> final out => ', countOut);
    });