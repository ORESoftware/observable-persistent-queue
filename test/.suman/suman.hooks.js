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

let id = 0;

module.exports = (suite) => {

    console.log('is running before');
    suite.uniqueId = id++;

    suite.before.cb(h => {

        h.done();

    });

};