function createSignalRWSTransport (lib, mylib, timerlib) {
  'use strict';

  var q = lib.q,
    qlib = lib.qlib,
    JobOnDestroyableBase = qlib.JobOnDestroyableBase,
    Transport = mylib.Transport;

  function SignalRWSTransport (ws) {
    Transport.call(this);
    this.ws = ws;
    this.onDataer = this.onData.bind(this);
    this.onErrorer = this.onError.bind(this);
    this.onCloseer = this.destroy.bind(this);
    this.ws.on('message', this.onDataer);
    this.ws.on('error', this.onErrorer);
    this.ws.on('close', this.onCloseer);
  }
  lib.inherit(SignalRWSTransport, Transport);
  SignalRWSTransport.prototype.__cleanUp = function () {
    if (this.ws) {
      this.ws.off('message', this.onDataer);
      this.ws.off('error', this.onErrorer);
      this.ws.off('close', this.onCloseer);
      this.ws.terminate();
    }
    this.onDataer = null;
    this.onErrorer = null;
    this.onCloseer = null;
    this.ws = null;
    Transport.prototype.destroy.call(this);
  };
  SignalRWSTransport.prototype.remoteAddress = function () {
    return this.ws ? this.ws._socket.remoteAddress : '';
  };
  SignalRWSTransport.prototype.onData = function (data) {
    this.invokeDataCB(data).then(
      this.send.bind(this),
      console.error.bind(console, 'onDataErr')
    );
  };
  SignalRWSTransport.prototype.onError = function (err) {
    console.error('WS error', err);
    this.destroy(err);
  };
  SignalRWSTransport.prototype.realSender = function (string) {
    var defer = q.defer(), ret = defer.promise;
    if (!this.ws) {
      defer.reject(new lib.Error('ALREADY_DEAD', 'This instance of SignalRWSTransport is already destroyed'));
      return ret;
    }
    this.ws.send(string, function (err) {
      if (err) {
        defer.reject(err);
      } else {
        defer.resolve(true);
      }
      defer = null;
    });
    return ret;
  };

  mylib.WSTransport = SignalRWSTransport;
}
module.exports = createSignalRWSTransport;
