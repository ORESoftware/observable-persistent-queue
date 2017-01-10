'use strict';

//core
const readline = require('readline');
const fs = require('fs');

//npm
const Rx = require('rxjs');


////////////////////////////////////////////////////////////////////////////////


module.exports = function(file, rgx){

    rgx = rgx || '\\S+';

    return Rx.Observable.create(sub => {

        const rl = readline.createInterface({
            input: fs.createReadStream(file, {autoClose: true})
        });

        let count = 0;

        rl.on('close', function(){
            rl.close();
            rl.removeListener('line', onLine);
            sub.next({count: count});
            sub.complete();
        });

        const onLine = line => {
            if (String(line).match(rgx)) {
                count++;
            }
        };


        rl.on('line', onLine);

    });

};
