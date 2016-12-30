'use strict';

const cp = require('child_process');
const Rx = require('rxjs');

const colors = require('colors/safe');
const path = require('path');

const debug = require('debug')('cmd-queue');

/////////////////////////////////////////////////////////////////////////////////////////////

module.exports = function (queue, pattern, count) {

    pattern = pattern || '\\S+';
    count = count || 1;

    return Rx.Observable.create(obs => {

        const file = queue.filepath;
        const execPath = path.resolve(__dirname, 'blank-multiple.py');
        const n = cp.spawn(execPath, [file, pattern, count]);

        n.once('error', function (err) {
            console.error(colors.red(' => spawn error => \n', err.stack || err));
            obs.error(err);
        });

        n.stdout.setEncoding('utf8');
        n.stderr.setEncoding('utf8');

        n.stderr.on('data', function (d) {
            if (d && String(d).trim())
                console.error('\n', colors.red(' => sed spawn stderr => '), '\n', d);
        });

        var data = '';

        n.stdout.on('data', function (d) {
            debug(' => Data from python => ', d);
            data += d;
        });

        n.once('close', function (code) {
            if (code > 0) {
                console.error(colors.bgRed(' => Exit code of sed command => '), code);
            }

            n.stderr.removeAllListeners();
            n.stdout.removeAllListeners();
            n.removeAllListeners();

            obs.next(data);
            obs.complete();
        });

        return function () {
            // console.log('disposing appendFile()');
        }

    });

};