'use strict';
var readline = require('readline');
var fs = require('fs');
var Rx = require('rxjs');
module.exports = function (file, rgx) {
    rgx = rgx || '\\S+';
    return Rx.Observable.create(function (sub) {
        var rl = readline.createInterface({
            input: fs.createReadStream(file, { autoClose: true })
        });
        var count = 0;
        rl.on('close', function () {
            rl.close();
            rl.removeListener('line', onLine);
            sub.next({ count: count });
            sub.complete();
        });
        var onLine = function (line) {
            if (String(line).match(rgx)) {
                count++;
            }
        };
        rl.on('line', onLine);
    });
};
