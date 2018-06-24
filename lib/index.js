/* jshint node: true */

var through = require('through2');
var PluginError = require('plugin-error');
var fancyLog = require('fancy-log');

var PLUGIN_NAME = 'graceful-gulp';

function isFunction(func) {
  return func instanceof Function;
}

function isStream(value) {
  return isFunction(value.pipe) && isFunction(value.emit);
}

function logErr(err) {
  // wrap the original error... because?
  var logErr = new PluginError(PLUGIN_NAME, err);

  // log that this error happened
  fancyLog.info(logErr.toString());
}

function failOnExit(err) {
  logErr(err);

  // set the exit code, so that whenever the build
  // exits, it does so with an error
  process.exitCode = 1;
}

function wrap(stream) {
  if (!isStream(stream)) {
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

    // log this error and make sure the process exits with
    // an error code when it inevitably exits on its own
    failOnExit(err);

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

function gracefulStream() {
  var passthrough = through.obj();

  return wrap(passthrough);
}

function gracefulAsyncTask(func) {
  return function (done) {
    func(function (err) {
      // if there was an error, make sure the process
      // exits with an error once it exits on its own
      // at some later point
      if (err) {
        failOnExit(err);
      }

      // the actual gulp task shoud succeed
      done();
    });
  };
}

function gracefulSyncTask(func) {
  return function () {
    var value = func();

    if (isFunction(value.then) && isFunction(value.catch)) {
      return gracefulPromise(value);
    }

    if (isStream(value)) {
      return wrap(value).graceful();
    }

    // I don't know what this is, but I don't think
    // gulp can handle it... just return it
    return value;
  };
}

function gracefulPromise(promise) {
  return promise.catch(function (err) {
    failOnExit(err);
  });
}

function gracefulTask(func) {
  if (func.length > 0) {
    return gracefulAsyncTask(func);
  }

  return gracefulSyncTask(func);
}

module.exports = function (arg) {
  if (isFunction(arg)) {
    return gracefulTask(arg);
  }

  return gracefulStream();
};
