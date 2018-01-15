/* jshint node: true */

var through = require('through2');
var PluginError = require('plugin-error');
var fancyLog = require('fancy-log');

var PLUGIN_NAME = 'graceful-gulp';

function isFunction(func) {
  return func instanceof Function;
}

function logErr(err) {
  // wrap the original error... because?
  var logErr = new PluginError(PLUGIN_NAME, err);

  // log that this error happened
  fancyLog.info(logErr.toString());
}

function wrap(stream) {
  if (!isFunction(stream.pipe) || !isFunction(stream.emit)) {
    throw new TypeError('parameter must be a stream');
  }

  var gracefulError = false;
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

    // we will only handle one error... sometimes more
    // errors might happen, and we will ignore them,
    // since we have already failed once and ended
    // the stream... see #1
    if (errorHandled) {
      return stream;
    }

    errorHandled = true;

    logErr(err);

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

  return stream;
}

module.exports = function () {
  var passthrough = through.obj();

  return wrap(passthrough);
};
