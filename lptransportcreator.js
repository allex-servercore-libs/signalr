function createSignalRLongPollingTransport (lib, mylib) {
  'use strict';

  var q = lib.q,
    qlib = lib.qlib,
    Transport = mylib.Transport;

  function SignalRLongPollingTransport (remoteaddress) {
    Transport.call(this);
    this.myRemoteAddress = remoteaddress;
    this.processingPost = false;
    this.poller = null;
  }
  lib.inherit(SignalRLongPollingTransport, Transport);
  SignalRLongPollingTransport.prototype.__cleanUp = function () {
    if (this.poller) {
      this.poller.end();
    }
    this.poller = null;
    this.processingPost = null;
    this.myRemoteAddress = null;
    Transport.prototype.destroy.call(this);
  };
  SignalRLongPollingTransport.prototype.remoteAddress = function () {
    return this.myRemoteAddress;
  };
  SignalRLongPollingTransport.prototype.handle = function (req, res) {
    if (!(req && lib.isFunction(req.on) && lib.isFunction(req.off))) {
      return;
    }
    if (this.processingPost) {
      res.writeError(409);
      res.end();
      return;
    }
    switch (req.method) {
      case 'GET':
        this.handlePoll(res);
        break;
      case 'POST':
        this.handlePost(req, res);
        break;
      default:
        return;
    }
  };
  SignalRLongPollingTransport.prototype.handlePost = function (req, res) {
    this.processingPost = true;
    (new mylib.PostHttpRequestReqder(req)).go().then(
      this.onPostRead.bind(this, res),
      function (reason) {
        console.error('reason', reason);
        res.writeError(400);
        res.end();
        res = null;
      }
    );

  };
  SignalRLongPollingTransport.prototype.handlePoll = function (res) {
    var bound;
    if (this.drainerPromise) {
      bound = this.handlePoll.bind(this, res);
      this.drainerPromise.then(bound, bound);
      return;
    }
    this.poller = res;
  };
  SignalRLongPollingTransport.prototype.onPostRead = function (res, payload) {
    this.processingPost = false;
    res.writeHeader(200);
    res.end();
    this.invokeDataCB(payload).then(
      this.send.bind(this),
      console.error.bind(console, 'onDataErr')
    );
  };
  SignalRLongPollingTransport.prototype.realSender = function (string) {
    var defer, ret;
    if (!this.poller) {
      return q.reject(new lib.Error('NO_POLLER_TO_WRITE_TO'));
    }
    defer = q.defer();
    ret = defer.promise;
    this.poller.write(string, 'utf8', function (err) {
      if (err) {
        defer.reject(err);
      } else {
        defer.resolve(true);
      }
      defer = null;
    });
    return ret;
  };
  SignalRLongPollingTransport.prototype.canStartDrain = function () {
    return Transport.prototype.canStartDrain.call(this) && this.poller;
  };
  SignalRLongPollingTransport.prototype.onDrainDone = function () {
    this.poller.end();
    this.poller = null;
    Transport.prototype.onDrainDone.call(this);
  };

  mylib.LPTransport = SignalRLongPollingTransport;

}
module.exports = createSignalRLongPollingTransport;
