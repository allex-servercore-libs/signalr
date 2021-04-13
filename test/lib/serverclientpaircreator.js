function createServerClientPairLib (mylib) {
  'use strict';

  var JobOnDestroyableBase = lib.qlib.JobOnDestroyableBase;

  function ServerClientPair (port, defer) {
    this.server = mylib.createHttpServer(port, this.onClientMessage.bind(this));
    this.client = null;
    this.clientSaid = new lib.HookCollection();
    this.serverSaid = new lib.HookCollection();
    mylib.createHttpClient(port).then(
      this.onClientCreated.bind(this, defer),
      defer.reject.bind(this)
    );
  }
  ServerClientPair.prototype.destroy = function () {
    if (this.serverSaid) {
      this.serverSaid.destroy();
    }
    this.serverSaid = null;
    if (this.clientSaid) {
      this.clientSaid.destroy();
    }
    this.clientSaid = null;
    if (this.client) {
      this.client.stop();
    }
    this.client = null;
    if (this.server) {
      this.server.closeServer();
      this.server.destroy();
    }
    this.server = null;
  };
  ServerClientPair.prototype.testSingleServerToClient = function (channel) {
    return new Server2ClientAwaitingJob(this, channel).go();
  };
  ServerClientPair.prototype.testSequenceServerToClient = function (channel, length) {
    return new Server2ClientSequenceAwaitingJob(this, channel, length).go();
  };
  ServerClientPair.prototype.onClientCreated = function (defer, client) {
    this.client = client;
    this.client.on('_', this.onServerMessage.bind(this));
    defer.resolve(this);
  };
  ServerClientPair.prototype.onClientMessage = function () {
    if (!this.clientSaid) {
      return;
    }
    this.clientSaid.fire.apply(this.clientSaidListener, arguments);
  };
  ServerClientPair.prototype.onServerMessage = function (msg) {
    if (!this.serverSaid) {
      return;
    }
    this.serverSaid.fire.apply(this.serverSaid, arguments);
  };

  function AwaitingJob (serverclientpair, channel, defer) {
    JobOnDestroyableBase.call(this, serverclientpair, defer);
    this.rnd = this.generateRnd();
    this.channel = channel;
    this.clientSaidListener = this.destroyable.clientSaid.attach(this.onClient.bind(this));
    this.serverSaidListener = this.destroyable.serverSaid.attach(this.onServer.bind(this));
  }
  lib.inherit(AwaitingJob, JobOnDestroyableBase);
  AwaitingJob.prototype.destroy = function () {
    this.channel = null;
    this.rnd = null;
    JobOnDestroyableBase.prototype.destroy.call(this);
  };
  AwaitingJob.prototype._destroyableOk = function () {
    return this.destroyable && this.destroyable.server && this.destroyable.client;
  };
  AwaitingJob.prototype.go = function () {
    var ok = this.okToGo();
    if (!ok.ok) {
      return ok.val;
    }
    this.goProc();
    return ok.val;
  };

  function SingleAwaitingJob (serverclientpair, channel, defer) {
    AwaitingJob.call(this, serverclientpair, channel, defer);
  }
  lib.inherit(SingleAwaitingJob, AwaitingJob);
  SingleAwaitingJob.prototype.generateRnd = function () {
    return lib.uid();
  };
  SingleAwaitingJob.prototype.checkingFunc = function (msg) {
    if (msg && msg.msg === this.rnd) {
      this.resolve(true);
    }
  };

  function SequenceAwaitingJob (serverclientpair, channel, length, defer) {
    this.length = length || 0;
    AwaitingJob.call(this, serverclientpair, channel, defer);
  }
  lib.inherit(SequenceAwaitingJob, AwaitingJob);
  SequenceAwaitingJob.prototype.destroy = function () {
    AwaitingJob.prototype.destroy.call(this);
    this.length = null;
  };
  SequenceAwaitingJob.prototype.generateRnd = function () {
    var ret = [], i;
    for (i=0; i<this.length; i++) {
      ret.push({
        sequence: i,
        message: lib.uid()
      });
    }
    return ret;
  };
  SequenceAwaitingJob.prototype.checkingFunc = function (msg) {
    var firstrnd = this.rnd[0];
    if (msg && msg.msg) {
      var mmsg = msg.msg;
      if (mmsg.sequence == firstrnd.sequence && mmsg.message == firstrnd.message) {
        this.rnd.shift();
        if (this.rnd.length<1) {
          this.resolve(this.length);
        }
      }
    }
  };

  function Server2ClientAwaitingJob (serverclientpair, channel, defer) {
    SingleAwaitingJob.call(this, serverclientpair, channel, defer);
  }
  lib.inherit(Server2ClientAwaitingJob, SingleAwaitingJob);
  Server2ClientAwaitingJob.prototype.goProc = function () {
    var ch = this.destroyable.server.channels.get(this.channel);
    if (!ch) {
      this.reject(new lib.Error('NO_CHANNEL_FOUND', this.channel));
      return;
    }
    ch.invokeOnClient('_', {msg: this.rnd});   
  };
  Server2ClientAwaitingJob.prototype.onServer = SingleAwaitingJob.prototype.checkingFunc;
  Server2ClientAwaitingJob.prototype.onClient= function () {};

  function Server2ClientSequenceAwaitingJob (serverclientpair, channel, length, defer) {
    SequenceAwaitingJob.call(this, serverclientpair, channel, length, defer);
  }
  lib.inherit(Server2ClientSequenceAwaitingJob, SequenceAwaitingJob);
  Server2ClientSequenceAwaitingJob.prototype.goProc = function () {
    var ch = this.destroyable.server.channels.get(this.channel), i;
    if (!ch) {
      this.reject(new lib.Error('NO_CHANNEL_FOUND', this.channel));
      return;
    }
    for(i=0; i<this.length; i++) {
      ch.invokeOnClient('_', {msg: this.rnd[i]});   
    }
  };
  Server2ClientSequenceAwaitingJob.prototype.onServer = SequenceAwaitingJob.prototype.checkingFunc;
  Server2ClientSequenceAwaitingJob.prototype.onClient= function () {};


  function createServerClientPair (port) {
    var defer = q.defer();
    new ServerClientPair(port, defer);
    return defer.promise;
  }

  mylib.createServerClientPair = createServerClientPair;
}

module.exports = createServerClientPairLib;
