/**
 * Created by oleg on 12/24/16.
 */



// sed - i.bak
// '/5a262cf8-e545-49e0-93eb-05f0a27c3eb5/d'
// dogs.txt


const cp = require('child_process');
const Rx = require('rx-lite');

const colors = require('colors/safe');
const path = require('path');

/////////////////////////////////////////////////////////////////////////////////////////////

module.exports = function (queue, pattern) {

    // const n = cp.spawn('tail', ['-f', file]);

    return Rx.Observable.create(obs => {

        const file = queue.filepath;

        // const p = "/" + pattern + "/d";
        // const n = cp.spawn('sed', ['-i', p, file]);

        //sed -i '/TEXT_TO_BE_REPLACED/c\This line is removed by the admin.' /tmp/foo

        // const p = "/" + pattern + "/c\n";
        // const n = cp.spawn('sed', ['--in-place', p, file]);

        //grep pattern bigfile | overwrite bigfile

        const execPath = path.resolve(__dirname, 'blank.py');

        // const n = cp.spawn('grep', [pattern, file]);

        const t = cp.spawn(execPath, [file, pattern]);

        t.once('error', function (err) {
            console.error(colors.red(' => spawn error => \n', err.stack || err));
            obs.onError(err);
        });

        // n.stdout.setEncoding('utf8');
        // n.stderr.setEncoding('utf8');
        //
        // n.stderr.once('data', function (d) {
        //     if (d && String(d).trim())
        //         console.error(' => sed spawn stderr => \n', d);
        // });
        //
        // n.stdout.once('data', function (d) {
        //     t.stdin.write(d);
        // });
        //
        // n.on('close', (code) => {
        //     t.stdin.end();
        // });

        t.once('close', function (code) {
            if (code > 0) {
                console.error(colors.bgRed(' => Exit code of sed command => '), code);
            }
            obs.onNext();
            obs.onCompleted();
        });

        return function () {
            // console.log('disposing appendFile()');
        }

    });

};