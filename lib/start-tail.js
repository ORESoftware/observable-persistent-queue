'use strict';

//core
const util = require('util');

//npm
const colors = require('colors/safe');
const debug = require('debug')('opq');

//project
const tail = require('./tail');


//////////////////////////////////////////////////////////////////////////////

module.exports = (queue, push, clientEE) => {

    clientEE.emit('ready');
    queue.isReady = true;
    const fp = queue.filepath;

    //start tailing, only after we know that the file exists, etc.

    tail(fp).on('data', data => {

        debug('\n', colors.cyan(' => raw data (well, trimmed) from tail => '), '\n', String(data).trim());

        data = String(data).split('\n')
            .filter(ln => String(ln).trim().length > 0)
            .map(ln => String(ln).trim());

        data.map(function (d) {

            try {
                return JSON.parse(d);
            }
            catch (err) {
                console.log('\n', colors.red(' => bad data from tail => '), '\n', d);
                return '';
            }

        }).filter(function (d) {

            return String(d).trim().length > 0;

        }).forEach(d => {

            push(d);
        });

    });
};