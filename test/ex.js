/**
 * Created by oleg on 1/7/17.
 */


const Rx = require('rxjs');

const example = Rx.Observable.interval(1000)
    .map(val => Rx.Observable.of(val + 10))
    .concatAll()



example.subscribe(val => console.log('Example with Basic Observable:', val));


