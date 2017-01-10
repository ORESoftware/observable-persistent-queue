var cp = require('child_process');
var Rx = require('rxjs');
module.exports = function (file) {
    return Rx.Observable.create(function (obs) {
        var n = cp.spawn('head', ['-5', file]);
        n.once('error', function (err) {
            console.error(' => spawn error => \n', err.stack || err);
            obs.error(err);
        });
        n.stdout.setEncoding('utf8');
        n.stderr.setEncoding('utf8');
        n.stderr.once('data', function (d) {
            console.error(' => spawn stderr => \n', d);
            n.stderr.removeAllListeners();
            n.stdout.removeAllListeners();
            n.removeAllListeners();
            obs.error(d);
        });
        var data = '';
        n.stdout.on('data', function (d) {
            data += d;
        });
        n.once('close', function (code) {
            n.stderr.removeAllListeners();
            n.stdout.removeAllListeners();
            n.removeAllListeners();
            obs.next(data);
            obs.complete();
        });
    });
};
