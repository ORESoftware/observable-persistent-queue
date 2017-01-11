'use strict';

/// <reference path="node.d.ts" />

const gulp = require('gulp');
const ts = require('gulp-typescript');
const merge = require('merge2');

const tsProject = ts.createProject('tsconfig.json',{
    // declaration: true
});

gulp.task('scripts', function() {

    const tsResult = tsProject.src() // or tsProject.src()
        .pipe(tsProject());

    return merge([ // Merge the two output streams, so this task is finished when the IO of both operations is done.
        tsResult.dts.pipe(gulp.dest('release/definitions')),
        tsResult.js.pipe(gulp.dest('release/js'))
    ]);
});

gulp.task('default', ['scripts'], function() {
    gulp.watch('*', ['scripts']);
});