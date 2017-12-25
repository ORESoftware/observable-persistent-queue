//******************************************************************************************************************************
// this file allows you to configure network dependencies so that the Suman test runner can check to see if all require
// network components are live and ready to be incorporated in the test. Of course, you could just run the tests and see if
// they are live, but this feature allows you to have a fail-fast up-front check that will only run once, thus avoiding
// any potential overload of any of your network components that may already be under load.
// ******************************************************************************************************************************

//core
const fs = require('fs');
const path = require('path');

// npm
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

/////////////////////////////////////////////////////////////////////////////////////

module.exports = data => {

  // const pkgJSON = require('../../package.json');
  const pkgJSON = {
    name: 'observable-persistent-queue'
  };

  const rootTestPath = path.join(process.env.HOME, 'software_testing', pkgJSON.name);

  var callable = true;

  function removeTestDir(cb) {
    if (callable) {
      callable = false;

      rimraf(rootTestPath, function (err) {
        if (err) {
          console.error(err);
        }
        cb();
      })
    }
    else {
      process.nextTick(cb);
    }
  }

  return {

    dependencies: {

      'remove-test-dir': function (data, cb) {
        removeTestDir(cb);
      },

      'create-test-dir': function (data, cb) {
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

    }

  }

};
