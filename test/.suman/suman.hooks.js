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
const util = require('util');
const uuid = require('uuid');

let id = 0;

module.exports = (b, before) => {

  console.log('bbbb => ', util.inspect(b));

  // b.uniqueId = fs.statSync(b.filename).ino;
  b.uniqueId = uuid.v4();

  before.cb(h => {
    console.log('this is a before hook in suman.hooks.js.');
    h.done();
  });

};