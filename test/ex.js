/**
 * Created by oleg on 1/7/17.
 */


const Rx = require('rxjs');

var i = 0;

const obs = Rx.Observable.interval(10)
    .map(() => i++)
    .map(function(val){
        return Rx.Observable.create(obs => {
            obs.next(val)
        });
    })
    .take(10)
    .reduce(function (prev, curr) {
        return prev.concat(curr);
    })
    .last(function(val){
        return val.flatMap(function(val){
            return val;
        })
    })
    .dematerialize();



obs.subscribe(function(v){
    console.log('\n next (and only) result => \n', v);
});