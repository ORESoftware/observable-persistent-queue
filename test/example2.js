/**
 * Created by oleg on 1/7/17.
 */


const Rx = require('rxjs');

var i = 0;

const obs = Rx.Observable.interval(100)
    .flatMap(function () {
        return Rx.Observable.timer(Math.ceil(500 * Math.random()))
            .map(function (val) {
                console.log(' => These should all log first => ', val);
                return i++;
            });
    })
    .take(5)
    .reduce(function (prev, curr) {
        prev.push(curr);
        return prev;
    }, [])
    .last(function (results) {
        console.log('all done = > ', results);
    })
    .map(function(v){
        console.log(v);
    });


obs.subscribe();