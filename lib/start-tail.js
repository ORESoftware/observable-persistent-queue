'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var tail_1 = require("./tail");
var callable = true;
exports.startTail = function (q, push) {
    var fp = q.filepath;
    if (!callable) {
        return;
    }
    callable = false;
    tail_1.tail(fp).on('data', function (data) {
        data = String(data).split('\n')
            .filter(function (ln) { return String(ln).trim().length > 0; })
            .map(function (ln) { return String(ln).trim(); });
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
            .forEach(function (d) {
            push(d);
        });
    });
};
