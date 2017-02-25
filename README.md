# gulp graceful error

[![Build][1]][2]
[![Test Coverage][3]][4]
[![Code Climate][5]][6]
[![Downloads][7]][8]
[![Version][9]][8]
[![Dependency Status][10]][11]

[1]: https://travis-ci.org/catdad/gulp-graceful-error.svg?branch=master
[2]: https://travis-ci.org/catdad/gulp-graceful-error

[3]: https://codeclimate.com/github/catdad/gulp-graceful-error/badges/coverage.svg
[4]: https://codeclimate.com/github/catdad/gulp-graceful-error/coverage

[5]: https://codeclimate.com/github/catdad/gulp-graceful-error/badges/gpa.svg
[6]: https://codeclimate.com/github/catdad/gulp-graceful-error

[7]: https://img.shields.io/npm/dm/gulp-graceful-error.svg
[8]: https://www.npmjs.com/package/gulp-graceful-error
[9]: https://img.shields.io/npm/v/gulp-graceful-error.svg

[10]: https://david-dm.org/catdad/gulp-graceful-error.svg
[11]: https://david-dm.org/catdad/gulp-graceful-error

So, you want to run all your tasks in one build... you have your linting, unit tests, contract tests... all running when you run your build. And sometimes, one of those has a failure, and it halts your whole build. You have a linting error and now you can't see if there are any test failures in your CI. You have to wait for a whole new build, only to fix one more error without getting the full report. Why can't you just get a list of all the failures all at once? Right? Well, you've come to the right place.

`gulp-graceful-error` allows you to safely handle those failures while still being sure that the build will indeed fail.

Unlike similar modules out there (_cough `gulp-plumber` cough_), this module will still fail the otherall build, while only allowing the task itself to pass. It also allows you to apply the behavior to only parts of the pipeline in each task, as it requires graceful mode to be enabled on each one of the task steps. If some tasks produce ignorable errors but others must be fatal, you can do that.

## Example

```javascript
var gulp = require('gulp');
var eslint = require('gulp-eslint');
var mocha = require('gulp-mocha');
var graceful = require('gulp-graceful-error');

gulp.task('lint', function () {
  return gulp.src('lib/**/*.js')
    // add graceful to your pipeline
    .pipe(graceful())
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
    // call the `graceful` function on each stream
    // that you want to fail gracefully
    .graceful();
});

gulp.task('test', function () {
  return gulp.src('test/**/*.test.js')
    .pipe(graceful())
    .pipe(mocha())
    .graceful();
});
```
