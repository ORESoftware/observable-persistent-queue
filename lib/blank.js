#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const os = require('os');

const file = process.argv[2];
const rgx = new RegExp(process.argv[3]);

const fd = fs.openSync(file, 'r+');

const strm = fs.createReadStream(null, {fd: fd});

const rl = readline.createInterface({
    input: strm
});

const eolLength = String(os.EOL).length;

let position = 0;
let bytesRead = strm.bytesRead;

console.log(' => initial bytesRead => ', bytesRead);

const onLine = line => {

    console.log(' => line => ', line);

    if (String(line).match(rgx)) {

        let len = line.length;

        rl.close();
        rl.removeListener('line', onLine);

        // output the line that will be replaced/removed
        process.stdout.write(line + '\n');

        fs.write(fd, new Array(len + 1).join(' ') , position, 'utf8',

            (err, written, string) => {

            if (err) {
                process.stderr.write(err.stack || err);
                return process.exit(1);
            }
            else {
                process.exit(0);
            }

        });

    }
    else{

        position += (line.length + eolLength);
        console.log('position => ', position);
        console.log('bytes read => ', strm.bytesRead);
    }


};

rl.on('line', onLine);