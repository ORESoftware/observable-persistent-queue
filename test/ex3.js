
const Rx = require('rxjs');

var i = 0;

const obs = Rx.Observable.interval(10)
    .take(10)
    .map(() => i++)
    .map(function(val){  // note: map *not* flatMap
        return Rx.Observable.create(obs => {
            obs.next(val)
        });
    })
    // .reduce(function (prev, curr) {
    //     return prev.concat(curr);  // concat all observables
    // })
    .groupBy(function(){
        return true;
    })
    .flatMap(function(val){
        return val.concat()
    })
    .do(function(val){
        console.log('val => ', val);
    })
    .last(function(val){
        return val.flatMap(function(val){
            return val;
        })
    });


// subscribe to Observable
obs.subscribe(function(v){
    console.log('\n next (and only) result => \n', v);
});

