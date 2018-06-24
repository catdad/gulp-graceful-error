/* jshint node: true, mocha: true */

var stream = require('stream');

var expect = require('chai').expect;
var through = require('through2');
var unstyle = require('unstyle');
var mockIo = require('mock-stdio');

var util = require('./util.js');
var mod = util.mod;
var getLibInVm = util.getLibInVm;

function expectStream(obj) {
  expect(obj).to.be.instanceof(stream);
  expect(obj).to.have.property('pipe').and.to.be.a('function');
  expect(obj).to.have.property('on').and.to.be.a('function');
  expect(obj).to.have.property('emit').and.to.be.a('function');
}

function expectThroughObjectStream(obj) {
  expectStream(obj);

  expect(obj)
    .to.have.property('_readableState')
    .and.to.have.property('objectMode')
    .and.to.equal(true);

  expect(obj)
    .to.have.property('_writableState')
    .and.to.have.property('objectMode')
    .and.to.equal(true);
}

function expectGracefulStream(obj) {
  expectStream(obj);
  expect(obj).to.have.property('graceful').and.to.be.a('function');
}

describe('when called with no arguments', function () {
  it('returns a transform object stream', function () {
    var out = mod.lib();

    // uses object streams by default
    expectThroughObjectStream(out);
    expectGracefulStream(out);
  });

  it('wraps a stream that is piped in', function () {
    var stream = through();

    var originalPipe = stream.pipe;
    var originalEmit = stream.emit;

    var wrapped = mod.lib().pipe(stream);

    expect(wrapped)
      .to.have.a.property('pipe')
      .and.to.be.a('function')
      .and.to.not.equal(originalPipe);

    expect(wrapped)
      .to.have.a.property('emit')
      .and.to.be.a('function')
      .and.to.not.equal(originalEmit);

    expectStream(wrapped);
    expectGracefulStream(wrapped);
  });

  it('throws an error if a non-stream is piped in', function () {
    expect(function () {
      mod.lib().pipe('not a stream');
    }).to.throw(TypeError, 'parameter must be a stream');
  });

  it('passes through events that are emitted on the stream', function (done) {
    var stream = mod.lib();

    stream.on('pineapples', function (arg1, arg2) {
      expect(arg1).to.equal(1);
      expect(arg2).to.equal(2);

      done();
    });

    stream.emit('pineapples', 1, 2);
  });

  it('passes through events that are emitted on a stream that is piped in', function (done) {
    var stream = through();
    var wrapped = mod.lib().pipe(stream);

    wrapped.on('pineapples', function (arg1, arg2) {
      expect(arg1).to.equal(1);
      expect(arg2).to.equal(2);

      done();
    });

    stream.emit('pineapples', 1, 2);
  });

  it('passes errors by default', function (done) {
    var ERR = new Error('pineapple error');

    var stream = mod.lib();

    stream.on('error', function (err, arg1) {
      expect(err).to.equal(ERR);
      expect(arg1).to.equal(1);

      done();
    });

    stream.emit('error', ERR, 1);
  });

  it('passes errors by default on streams that are piped in', function (done) {
    var ERR = new Error('pineapple error');

    var stream = through();
    var wrapped = mod.lib().pipe(stream);

    wrapped.on('error', function (err, arg1) {
      expect(err).to.equal(ERR);
      expect(arg1).to.equal(1);

      done();
    });

    stream.emit('error', ERR, 1);
  });

  it('returns the piped in stream from the pipe method', function () {
    var stream = through();

    var returnValue = mod.lib().pipe(stream);

    expect(returnValue).to.equal(stream);
  });

  describe('#graceful', function () {
    it('can be chained from the graceful method', function () {
      var stream = mod.lib();

      var returnValue = stream.graceful();

      expect(returnValue).to.equal(stream);
    });

    it('can be chained from the graceful method of a piped-in stream', function () {
      var stream = through();

      var returnValue = mod.lib().pipe(stream).graceful();

      expect(returnValue).to.equal(stream);
    });

    it('sets process.exitCode when an error is encountered in graceful mode', function (done) {
      mockIo.start();

      var proc = {};
      var ERR = new Error('pineapples');
      var stream = through();
      var vmMod = getLibInVm(proc);

      var wrapped = vmMod().pipe(stream);

      wrapped.graceful();

      wrapped.on('end', function () {
        expect(proc).to.have.property('exitCode').to.equal(1);

        var ioData = mockIo.end();

        util.expectIoError(ioData, ERR);

        done();
      });

      stream.emit('error', ERR);
    });

    it('silently handled any error after the first in graceful mode', function (done) {
      mockIo.start();

      var stream = through();
      var vmMod = getLibInVm();

      var wrapped = vmMod().pipe(stream);

      wrapped.graceful();

      wrapped.on('end', function () {
        var ioData = mockIo.end();

        expect(ioData.stdout).to.have.length.above(0);
        expect(ioData.stderr).to.have.lengthOf(0);

        var stdout = unstyle.string(ioData.stdout);

        expect(stdout).to.match(/invalid non-string\/buffer chunk/i);

        done();
      });

      stream.write(42);
      stream.write(43);
      stream.write(44);
    });

    it('can be override graceful mode by passing in a boolean to the graceful function', function (done) {
      var ERR = new Error('pineapples');
      var stream = through();
      var wrapped = mod.lib().pipe(stream);

      wrapped.graceful();
      wrapped.graceful(false);

      wrapped.on('error', function (err) {
        expect(err).to.equal(ERR);

        done();
      });

      stream.emit('error', ERR);
    });
  });

});
