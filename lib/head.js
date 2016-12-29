

const cp = require('child_process');
const Rx = require('rx-lite');


module.exports = function (file) {

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

            n.stderr.removeAllListeners();
            n.stdout.removeAllListeners();
            n.removeAllListeners();

            obs.onError(d);
        });

        var data = '';

        n.stdout.on('data', function (d) {
             data += d;
        });

        n.once('close', function(code){

            n.stderr.removeAllListeners();
            n.stdout.removeAllListeners();
            n.removeAllListeners();

            obs.onNext(data);
            obs.onCompleted();
        });

    });



};