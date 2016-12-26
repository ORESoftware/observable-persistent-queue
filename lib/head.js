

const cp = require('child_process');
const Rx = require('rx-lite');


module.exports = function (file) {

    // const n = cp.spawn('tail', ['-f', file]);

    return Rx.Observable.create(obs => {

        const n = cp.spawn('head', ['-5', file]);

        n.once('error', function (err) {
            console.error(' => spawn error => \n' ,err.stack || err);
            obs.onError(err);
        });

        n.stdout.setEncoding('utf8');
        n.stderr.setEncoding('utf8');

        n.stderr.once('data', function (d) {
            console.error(' => spawn stderr => \n', d);
            obs.onError(d);
        });

        n.stdout.once('data', function (d) {
            obs.onNext(d);
            obs.onCompleted();
        });

    });



};