'use strict';

//core
import util = require('util');

import {Observable} from 'rxjs/Rx';
const proto = <any> Observable.prototype;

///////////////////////////////////////////////

proto.backpressure = function(fn){

  const source = this;

  return Observable.create(sub => {

      return source.subscribe(
          function onNext(val){
              fn.call(sub,val.data,function(err, data){
                  if(err){
                      sub.error(err);
                  }
                  else{
                      console.log(util.inspect(val));
                      process.nextTick(val.cb.bind(val));
                      sub.next(data);
                  }
              });
          },
          function onError(e){
              sub.error(e);
          },
          function onComplete(){
              sub.complete();
          }
      )
  });

};