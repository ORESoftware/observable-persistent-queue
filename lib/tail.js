'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var cp = require("child_process");
var colors = require("chalk");
var unref = function (n) {
    n.stderr.removeAllListeners();
    n.stdout.removeAllListeners();
    n.removeAllListeners();
    n.unref();
};
exports.tail = function (fp) {
    var n = cp.spawn('tail', ['-F', '-n', '+1', fp]);
    n.on('error', function (err) {
        console.error('\n', colors.bgRed(' => spawn error => '), '\n', err.stack || err);
        unref(n);
    });
    n.stdout.setEncoding('utf8');
    n.stderr.setEncoding('utf8');
    n.stderr.on('data', function (d) {
        console.error('\n', colors.bgRed.white.bold(' => tail spawn stderr => '), '\n', String(d));
    });
    process.once('exit', function () {
        n.kill();
    });
    n.on('close', function (code) {
        unref(n);
        console.error('\n', colors.bgRed(' => tail child process may have closed prematurely => '), code);
    });
    return n.stdout;
};
