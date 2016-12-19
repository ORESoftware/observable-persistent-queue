
const Rx = require('rx-lite');

const values = [1, 2, 3];

const obs = Rx.Observable.from(values);

obs.subscribe(
    function onNext(result) {
        console.log('item =>', result);
    },
    function onError(e) {
        console.error(e.stack || e);
    },
    function onCompleted() {
        console.log('observable is completed');
    }
);


setTimeout(function () {

    values.push(4);
    values.push(5);
    values.push(6);

}, 3000);