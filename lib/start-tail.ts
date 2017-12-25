'use strict';

//core
import util = require('util');
import EE = require('events');

//npm
import colors = require('chalk');
import {Queue} from './queue';

//project
import {tail} from './tail';
let callable = true;

//////////////////////////////////////////////////////////////////////////////

export const startTail = (q: Queue, push: Function) => {
  
  const fp = q.filepath;
  
  //start tailing, only after we know that the file exists, etc.
  if (!callable) {
    return;
  }
  
  // we just want call this code once per runtime
  callable = false;
  
  tail(fp).on('data', (data: any) => {
    
    data = String(data).split('\n')
    .filter(ln => String(ln).trim().length > 0)
    .map(ln => String(ln).trim());
    
    data.map(function (d) {
      try {
        return JSON.parse(d);
      }
      catch (err) {
        process.emit('warning', 'bad data from tail', d);
        return '';
      }
    })
    .filter(function (d) {
      return String(d).trim().length > 0;
    })
    .forEach(d => {
      push(d);
    });
    
  });
};