/* jshint node: true */

var gutil = require('gulp-util');
var through = require('through2');

var PLUGIN_NAME = 'graceful-gulp';

function isFunction(func) {
  return func instanceof Function;
}

function wrap(stream) {
  if (!isFunction(stream.pipe) || !isFunction(stream.emit)) {
    throw new TypeError('parameter must be a stream');
  }

  var gracefulError = false;
  var once = false;
  var errorHandled = false;

  var pipe = stream.pipe.bind(stream);
  var emit = stream.emit.bind(stream);

  // wrap all streams at the time that they are piped in
  stream.pipe = function (destStream, opts) {
    return pipe(wrap(destStream), opts);
  };

  // overload emit function in case this stream is allowed
  // to ignore errors in the future
  stream.emit = function (name, err) {
    // if this is not an error, or we are not in
    // graceful mode, emit the event as expected
    if (name !== 'error' || gracefulError === false) {
      return emit.apply(null, arguments);
    }

    if (once && errorHandled) {
      return stream;
    }

    errorHandled = true;

    // wrap the original error... because?
    var logErr = new gutil.PluginError(PLUGIN_NAME, err);

    // log that this error happened
    gutil.log(logErr.toString());

    // set the exit code, so that whenever the build
    // exits, it does so with an error
    process.exitCode = 1;

    // emit a regular end event, since an error is supposed
    // to end the stream
    return emit('end');
  };

  // when calling continue, we will allow this stream
  // to swallow errors, and instead set the exitCode
  // for when the build eventually exits
  stream.graceful = function (val) {
    gracefulError = typeof val === 'boolean' ? val : true;

    return stream;
  };

  stream.gracefulOnce = function (val) {
    once = true;

    return stream.graceful(val);
  };

  return stream;
}

module.exports = function () {
  var passthrough = through.obj();

  return wrap(passthrough);
};
