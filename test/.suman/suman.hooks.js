/**
 *  note to developers: use this suman.hooks.js file to run any before/after/beforeEach/afterEach hook for any/every suite
 *
 *  they will be run for all your test files, unless you run some conditional logic, aka
 *
 *  if(suite.name === 'x'){}
 *
 */

const fs = require('fs');
const path = require('path');
const util  = require('util');

let id = 0;

module.exports = (suite) => {

    suite.uniqueId = fs.statSync(suite.fileName).ino;

    suite.before.cb(h => {

        h.done();

    });

};