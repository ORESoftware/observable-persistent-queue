/**
 * Created by oleg on 12/17/16.
 */


// const path = require('path');
// const util = require('util');
// const fs = require('fs');
// const colors = require('colors/safe');


const stream = require('stream');


// export class Readable extends events.EventEmitter implements NodeJS.ReadableStream {
//     readable: boolean;
//     constructor(opts?: ReadableOptions);
//     protected _read(size: number): void;
//     read(size?: number): any;
//     setEncoding(encoding: string): void;
//     pause(): Readable;
//     resume(): Readable;
//     isPaused(): boolean;
//     pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T;
// unpipe<T extends NodeJS.WritableStream>(destination?: T): void;
// unshift(chunk: any): void;
// wrap(oldStream: NodeJS.ReadableStream): NodeJS.ReadableStream;
// push(chunk: any, encoding?: string): boolean;
//
// /**
//  * Event emitter
//  * The defined events on documents including:
//  *   1. close
//  *   2. data
//  *   3. end
//  *   4. readable
//  *   5. error
//  **/
// addListener(event: string, listener: Function): this;
// addListener(event: string, listener: Function): this;
// addListener(event: "close", listener: () => void): this;
// addListener(event: "data", listener: (chunk: Buffer | string) => void): this;
// addListener(event: "end", listener: () => void): this;
// addListener(event: "readable", listener: () => void): this;
// addListener(event: "error", listener: (err: Error) => void): this;
//
// emit(event: string, ...args: any[]): boolean;
// emit(event: "close"): boolean;
// emit(event: "data", chunk: Buffer | string): boolean;
// emit(event: "end"): boolean;
// emit(event: "readable"): boolean;
// emit(event: "error", err: Error): boolean;
//
// on(event: string, listener: Function): this;
// on(event: "close", listener: () => void): this;
// on(event: "data", listener: (chunk: Buffer | string) => void): this;
// on(event: "end", listener: () => void): this;
// on(event: "readable", listener: () => void): this;
// on(event: "error", listener: (err: Error) => void): this;
//
// once(event: string, listener: Function): this;
// once(event: "close", listener: () => void): this;
// once(event: "data", listener: (chunk: Buffer | string) => void): this;
// once(event: "end", listener: () => void): this;
// once(event: "readable", listener: () => void): this;
// once(event: "error", listener: (err: Error) => void): this;
//
// prependListener(event: string, listener: Function): this;
// prependListener(event: "close", listener: () => void): this;
// prependListener(event: "data", listener: (chunk: Buffer | string) => void): this;
// prependListener(event: "end", listener: () => void): this;
// prependListener(event: "readable", listener: () => void): this;
// prependListener(event: "error", listener: (err: Error) => void): this;
//
// prependOnceListener(event: string, listener: Function): this;
// prependOnceListener(event: "close", listener: () => void): this;
// prependOnceListener(event: "data", listener: (chunk: Buffer | string) => void): this;
// prependOnceListener(event: "end", listener: () => void): this;
// prependOnceListener(event: "readable", listener: () => void): this;
// prependOnceListener(event: "error", listener: (err: Error) => void): this;
//
// removeListener(event: string, listener: Function): this;
// removeListener(event: "close", listener: () => void): this;
// removeListener(event: "data", listener: (chunk: Buffer | string) => void): this;
// removeListener(event: "end", listener: () => void): this;
// removeListener(event: "readable", listener: () => void): this;
// removeListener(event: "error", listener: (err: Error) => void): this;
// }

//
// export interface ReadableOptions {
//     highWaterMark?: number;
//     encoding?: string;
//     objectMode?: boolean;
//     read?: (size?: number) => any;
// }


// export interface WritableOptions {
//     highWaterMark?: number;
//     decodeStrings?: boolean;
//     objectMode?: boolean;
//     write?: (chunk: string | Buffer, encoding: string, callback: Function) => any;
//     writev?: (chunks: { chunk: string | Buffer, encoding: string }[], callback: Function) => any;
// }


function getWritable() {

    return new stream.Writable({
        write: function (chunk, encoding, cb) {
            console.log(' => chunk => ', String(chunk));
            setTimeout(cb, 400);
        }
    });

}


function getReadable(data) {

    let i = 0;

    const r = new stream.Readable({
        encoding: 'utf8',
        objectMode: false,
        read: function (n) {

            console.log('reading' + i++);

        }
    });


    setInterval(() => {
        console.log('pushing frog');
        r.push('frog');
        // console.log('data =>', data);
    },1600);

    return r;

}


const readableStrm = getReadable([1, 2, 3, 4, 5]);

const w1 = getWritable();
// const w2 = getWritable();
// const w3 = getWritable();

const piped1 = readableStrm.pipe(w1);
// const piped2 = readableStrm.pipe(w1);
// const piped3 = readableStrm.pipe(w1);

piped1.on('finish', function () {
    console.log('finish');
});

// piped2.on('finish', function () {
//     console.log('finish');
// });
//
// piped3.on('finish', function () {
//     console.log('finish');
// });














