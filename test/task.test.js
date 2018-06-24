/* jshint node: true, mocha: true */
/* global Promise */

var expect = require('chai').expect;
var mockIo = require('mock-stdio');
var through = require('through2');
var Promise = Promise || require('es6-promise').Promise;

var util = require('./util.js');
var mod = util.mod;
var getLibInVm = util.getLibInVm;

describe('when called with a function as the first parameter', function () {
  it('returns a function with 0 parameters if passed a function with 0 parameters', function () {
    var task = mod.lib(function () {});

    expect(task).to.be.a('function').and.to.have.lengthOf(0);
  });

  it('returns a function with 1 parameter if passed a function with 1 parameter', function () {
    var task = mod.lib(function (a) {});

    expect(task).to.be.a('function').and.to.have.lengthOf(1);
  });

  describe('when the task returns a stream', function () {
    it('returns a graceful stream', function () {
      var stream = through();
      var task = mod.lib(function () {
        return stream;
      });

      var returnValue = task();

      // returns same stream
      expect(returnValue).to.equal(stream);
      util.expectGracefulStream(returnValue);
    });

    it('sets process.exitCode on errors and successfully ends the stream', function (done) {
      mockIo.start();

      var proc = {};
      var ERR = new Error('pancakes');
      var stream = through();
      var task = mod.inVm(proc)(function () {
        setImmediate(function () {
          stream.emit('error', ERR);
        });

        return stream;
      });

      var returnValue = task();

      returnValue.on('error', function (err) {
        mockIo.end();
        done(err);
      });

      returnValue.on('end', function () {
        var io = mockIo.end();

        util.expectIoError(io, ERR);
        expect(proc.exitCode).to.equal(1);

        done();
      });
    });
  });

  describe('when the task returns a promise', function () {
    function expectPromise(val) {
      expect(val).to.have.property('then').and.to.be.a('function');
      expect(val).to.have.property('catch').and.to.be.a('function');
    }

    it('returns a promise', function () {
      var expected = 'pineapples';
      var task = mod.lib(function () {
        return Promise.resolve(expected);
      });

      var val = task();
      expectPromise(val);

      return val.then(function (actual) {
        expect(actual).to.equal(expected);
      });
    });

    it('catches promise errors, sets process.exitCode, and resolves the promise', function () {
      mockIo.start();

      var proc = {};
      var expected = new Error('pineapples');
      var task = mod.inVm(proc)(function () {
        return Promise.reject(expected);
      });

      var val = task();
      expectPromise(val);

      return val.then(function (value) {
        var io = mockIo.end();

        util.expectIoError(io, expected);
        expect(proc.exitCode).to.equal(1);
        expect(value).to.equal(undefined);
      }).catch(function (err) {
        mockIo.end();
        return Promise.reject(err);
      });
    });
  });

  describe('when the task is an asynchronous function', function () {
    it('returns undefined', function () {
      var task = mod.lib(function (a) {});
      var returnValue = task();

      expect(returnValue).to.equal(undefined);
    });

    it('sets process.exitCode on an error callback and completes the task successfully', function (done) {
      mockIo.start();

      var proc = {};
      var ERR = new Error('flapjacks');
      var task = mod.inVm(proc)(function (cb) {
        setImmediate(cb, ERR);
      });

      task(function (err) {
        if (err) {
          return done(err);
        }

        var io = mockIo.end();

        util.expectIoError(io, ERR);
        expect(proc.exitCode).to.equal(1);

        done();
      });
    });
  });

  describe('when the task is a synchronous function with unknown return', function () {
    it('returns the return value of the original function', function () {
      var expected = {};
      var task = mod.lib(function () {
        return expected;
      });

      expect(task()).to.equal(expected);
    });

    it('handled return value of null', function () {
      var expected = null;
      var task = mod.lib(function () {
        return expected;
      });

      expect(task()).to.equal(expected);
    });

    it('handles return value of undefined', function () {
      var expected;
      var task = mod.lib(function () {
        return expected;
      });

      expect(task()).to.equal(expected);
    });
  });
});
