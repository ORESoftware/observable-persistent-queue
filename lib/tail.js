/**
 * Created by oleg on 12/24/16.
 */


const colors = require('colors/safe');
const cp = require('child_process');


module.exports = function (file) {

    const n = cp.spawn('tail', ['-F', '-n', '+1', file]);
    // const n = cp.spawn('watch', ['tail', '-n', '+1', file]);

    n.on('error', function (err) {

        console.error('\n', colors.bgRed(' => spawn error => '), '\n', err.stack || err);

        n.stderr.removeAllListeners();
        n.stdout.removeAllListeners();
        n.removeAllListeners();
    });

    n.stdout.setEncoding('utf8');
    n.stderr.setEncoding('utf8');

    n.stderr.on('data', function (d) {
        console.error('\n', colors.bgRed(' => spawn stderr => '), '\n', String(d));
    });

    n.on('close', function(code){

        n.stderr.removeAllListeners();
        n.stdout.removeAllListeners();
        n.removeAllListeners();

        console.error('\n', colors.bgRed(' => tail child process may have closed prematurely => '), code);
    });

    return n.stdout;


};