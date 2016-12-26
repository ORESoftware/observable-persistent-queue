/**
 * Created by oleg on 12/26/16.
 */

// const fs = require('fs');
// const path = require('path');
//
// const fd = fs.openSync(process.env.HOME + '/dogs.txt','r+');
//
// console.log(fd.tell());

const os = require('os');

const eolLength = String(os.EOL);

console.log(eolLength);