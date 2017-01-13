const fs = require('fs');
const path = require('path');
const util = require('util');
let id = 0;
module.exports = (suite) => {
    suite.uniqueId = fs.statSync(suite.fileName).ino;
    suite.before.cb(h => {
        h.done();
    });
};
