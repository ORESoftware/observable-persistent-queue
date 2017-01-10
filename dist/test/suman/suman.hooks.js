var fs = require('fs');
var path = require('path');
var id = 0;
module.exports = function (suite) {
    console.log('is running before');
    suite.uniqueId = id++;
    suite.before.cb(function (h) {
        h.done();
    });
};
