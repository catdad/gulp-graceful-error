/* jshint node: true, mocha: true */

var stream = require('stream');

var expect = require('chai').expect;
var through = require('through2');

var lib = require('../');

describe('[index]', function () {
  it('is a function', function () {
    expect(lib).to.be.a('function');
  });

  it('returns a stream', function () {
    var out = lib();

    // test that it is stream-like...
    expect(out).to.be.instanceof(stream);
    expect(out).to.have.property('pipe').and.to.be.a('function');
    expect(out).to.have.property('on').and.to.be.a('function');
    expect(out).to.have.property('emit').and.to.be.a('function');
  });

  it('wraps a stream that is piped in', function () {
    var stream = through();

    var originalPipe = stream.pipe;
    var originalEmit = stream.emit;

    var wrapped = lib().pipe(stream);

    expect(wrapped)
      .to.have.a.property('pipe')
      .and.to.be.a('function')
      .and.to.not.equal(originalPipe);
    expect(wrapped)
      .to.have.a.property('emit')
      .and.to.be.a('function')
      .and.to.not.equal(originalEmit);
  });

  it('throws an error if a non-stream is piped in', function () {
    expect(function () {
      lib().pipe('not a stream');
    }).to.throw(TypeError, 'parameter must be a stream');
  });

  it('passes through events that are emitted on the stream', function (done) {
    var stream = through();
    var wrapped = lib().pipe(stream);

    wrapped.on('pineapples', function (arg1, arg2) {
      expect(arg1).to.equal(1);
      expect(arg2).to.equal(2);

      done();
    });

    stream.emit('pineapples', 1, 2);
  });

  it('passes through events that are emitted on a stream that is piped in');

  it('passes errors through by default');

  it('sets process.exitCode when an error is encountered in graceful mode');
});
