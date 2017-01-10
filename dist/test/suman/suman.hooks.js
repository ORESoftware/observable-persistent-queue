var fs = require('fs');
var path = require('path');
var util = require('util');
var id = 0;
module.exports = function (suite) {
    console.error('is running before');
    console.error('suite.fileName => ', suite.fileName);
    var fff = fs.statSync(suite.fileName);
    console.error('fff => ', util.inspect(fff));
    console.error('suite.fileName => ', suite.fileName);
    suite.uniqueId = fff.ino;
    suite.before.cb(function (h) {
        h.done();
    });
};
