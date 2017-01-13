'use strict';

//core
import util = require('util');
import EE = require('events');

//npm
import colors = require('colors/safe');
import {Queue} from './queue';
const debug = require('debug')('opq');

//project
import tail = require('./tail');

//////////////////////////////////////////////////////////////////////////////

export = (q: Queue, push: Function, clientEE: EE) => {

    clientEE.emit('ready');
    q.isReady = true;
    const fp = q.filepath;

    //start tailing, only after we know that the file exists, etc.

    tail(fp).on('data', (data: any) => {

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