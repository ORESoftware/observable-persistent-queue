'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var cp = require("child_process");
var logging_1 = require("./logging");
var unref = function (n) {
    n.stderr.removeAllListeners();
    n.stdout.removeAllListeners();
    n.removeAllListeners();
    n.unref();
};
exports.tail = function (fp) {
    var n = cp.spawn('tail', ['-F', '-n', '+1', fp]);
    n.on('error', function (err) {
        logging_1.log.error(' => spawn error => ', err.stack || err);
        unref(n);
    });
    n.stdout.setEncoding('utf8');
    n.stderr.setEncoding('utf8');
    n.stderr.on('data', function (d) {
        console.error('tail spawn stderr => ', String(d));
    });
    process.once('exit', function () {
        n.kill();
    });
    n.on('close', function (code) {
        unref(n);
        logging_1.log.error('tail child process may have closed prematurely => ', code);
    });
    return n.stdout;
};
