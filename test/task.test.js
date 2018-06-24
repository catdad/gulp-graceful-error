/* jshint node: true, mocha: true */

var expect = require('chai').expect;

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
    it('returns a graceful stream');

    it('sets process.exitCode on errors and successfully ends the stream');
  });

  describe('when the task returns a promise', function () {
    it('returns a promise');

    it('catches promise errors, sets process.exitCode, and resolves the promise');
  });

  describe('when the task is an asynchronous function', function () {
    it('returns undefined');

    it('sets process.exitCode on an error callback and completes the task successfully');
  });

  describe('when the task is a synchronous function with unknown return', function () {
    it('returns the return value of the original function');
  });
});
