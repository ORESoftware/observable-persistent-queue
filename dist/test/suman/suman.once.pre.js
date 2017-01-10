var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
module.exports = function (data) {
    var pkgJSON = {
        name: 'observable-persistent-queue'
    };
    var rootTestPath = path.join(process.env.HOME, 'software_testing', pkgJSON.name);
    var callable = true;
    function removeTestDir(cb) {
        if (callable) {
            callable = false;
            rimraf(rootTestPath, function (err) {
                if (err) {
                    console.error(err);
                }
                cb();
            });
        }
        else {
            process.nextTick(cb);
        }
    }
    return {
        'remove-test-dir': function (cb) {
            removeTestDir(cb);
        },
        'create-test-dir': function (cb) {
            removeTestDir(function (err) {
                if (err) {
                    cb(err);
                }
                else {
                    mkdirp(rootTestPath, function (err) {
                        if (err && err.code !== 'EEXIST') {
                            cb(err);
                        }
                        else {
                            cb(null, rootTestPath);
                        }
                    });
                }
            });
        }
    };
};
