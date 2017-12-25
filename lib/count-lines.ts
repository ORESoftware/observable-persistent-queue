'use strict';

//core
import readline = require('readline');
import fs = require('fs');

//npm
import {Observable} from 'rxjs/Rx';

////////////////////////////////////////////////////////////////////////////////

export = function (file: any, rgx: any) {
  
  rgx = rgx || '\\S+';
  
  return Observable.create(sub => {
    
    const rl = readline.createInterface({
      input: fs.createReadStream(file, {autoClose: true})
    });
    
    let count = 0;
    
    rl.on('close', function () {
      rl.removeListener('line', onLine);
      sub.next({count: count});
      sub.complete();
    });
    
    const onLine = line => {
      if (String(line).match(rgx)) {
        count++;
      }
    };
    
    rl.on('line', onLine);
    
  });
  
};
