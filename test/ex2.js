/**
 * Created by oleg on 1/7/17.
 */


const Rx = require('rxjs');

var i = 3;

const obs = Rx.Observable.interval(10)
    .map(() => i++)
    .map(function(val){
        return Rx.Observable.create(obs => {
            obs.next(val)
        });
    })
    .take(10)
    .concatMap(function(val){
        console.log('val => ', val);
        return val;
    });


obs.subscribe(function(v){
    console.log(v);
});