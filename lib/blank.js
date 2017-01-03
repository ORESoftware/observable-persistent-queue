#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const os = require('os');
const path = require('path');

const file = path.resolve(process.argv[2]);
const rgx = new RegExp(process.argv[3]);


var fd;
try {
    fd = fs.openSync(file, 'r+');
}
catch (err) {
    console.error(err.stack || err);
    return process.exit(1);
}

process.on('exit', function () {
    try {
        fs.closeSync(fd);
    }
    catch (err) {

    }
});


const strm = fs.createReadStream(null, {fd: fd, autoClose: false});

const rl = readline.createInterface({
    input: strm
});

const eolLength = String(os.EOL).length;

let position = 0;
let bytesRead = strm.bytesRead;

var matched = false;

const onLine = line => {

    if (!matched && String(line).match(rgx)) {

        let len = line.length;

        console.log('position => ', position);

        matched = true;

        rl.close();
        rl.removeListener('line', onLine);

        const a = new Array(len + 1).join(' ');
        console.log('a length => ', a.length);

        var val;
        try {
            val = fs.writeSync(fd, a, position, 'utf-8');
        }
        catch (err) {
            process.stderr.write((err.stack || err) + '\n');
            return process.exit(1);
        }

        // output the line that will be replaced/removed
        process.stdout.write(line + '\n');
        process.exit(0);

    }
    else {
        position += (line.length + eolLength);
    }


};


rl.on('line', onLine);