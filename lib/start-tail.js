'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var colors = require("colors/safe");
var debug = require('debug')('opq');
var tail_1 = require("./tail");
var callable = true;
exports.startTail = function (q, push) {
    var fp = q.filepath;
    if (!callable) {
        return;
    }
    callable = false;
    tail_1.tail(fp).on('data', function (data) {
        debug('\n', colors.cyan(' => raw data (well, trimmed) from tail => '), '\n', String(data).trim());
        data = String(data).split('\n')
            .filter(function (ln) { return String(ln).trim().length > 0; })
            .map(function (ln) { return String(ln).trim(); });
        data.map(function (d) {
            try {
                return JSON.parse(d);
            }
            catch (err) {
                console.log('\n', colors.red(' => bad data from tail => '), '\n', d);
                return '';
            }
        })
            .filter(function (d) {
            return String(d).trim().length > 0;
        })
            .forEach(function (d) {
            push(d);
        });
    });
};
