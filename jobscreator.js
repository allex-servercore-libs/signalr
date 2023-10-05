function createSignalRJobs (lib, mylib) {
  'use strict';
  var qlib = lib.qlib,
    JobOnDestroyableBase = qlib.JobOnDestroyableBase;

  function StringBufferSender (destroyable, stringbufferpropname, sendingfunc, lastsentnotifier, defer) {
    JobOnDestroyableBase.call(this, destroyable, defer);
    this.stringbufferpropname = stringbufferpropname;
    this.sendingfunc = sendingfunc;
    this.lastsentnotifier = lastsentnotifier;
    this.subJobs = new qlib.JobCollection();
    this.lastWriter = null;
  }
  lib.inherit(StringBufferSender, JobOnDestroyableBase);
  StringBufferSender.prototype.destroy = function () {
    this.lastWriter = null;
    if (this.subJobs) {
      this.subJobs.destroy();
    }
    this.subJobs = null;
    this.lastsentnotifier = null;
    this.sendingfunc = null;
    this.stringbuffer = null;
    JobOnDestroyableBase.prototype.destroy.call(this);
  };
  StringBufferSender.prototype._destroyableOk = function () {
    return this.destroyable && 
      this.destroyable[this.stringbufferpropname] &&
      lib.isFunction(this.destroyable[this.stringbufferpropname].hasContents);
  };
  StringBufferSender.prototype.go = function () {
    var ok = this.okToGo();
    if (!ok.ok) {
      return ok.val;
    }
    this.trySend();
    return ok.val;
  };
  StringBufferSender.prototype.trySend = function () {
    var sb;
    if (!this.okToProceed()) {
      return;
    }
    sb = this.destroyable[this.stringbufferpropname];
    if (!sb.hasContents()) {
      if (this.lastsentnotifier) {
        this.lastsentnotifier();
      }
      this.resolve(true);
      return;
    }
    sb.get(this.newSub.bind(this));
  };
  StringBufferSender.prototype.newSub = function (string) {
    this.lastWriter = new SubStringBufferSender(this, string);
    this.subJobs.run('.', this.lastWriter).then(
      this.trySend.bind(this),
      this.reject.bind(this)
    );
  }

  function JobOnStringBufferSender (sbsender, defer) {
    JobOnDestroyableBase.call(this, sbsender, defer);
  }
  lib.inherit(JobOnStringBufferSender, JobOnDestroyableBase);
  JobOnStringBufferSender.prototype._destroyableOk = function () {
    return this.destroyable &&
      lib.isFunction(this.destroyable._destroyableOk) &&
      this.destroyable._destroyableOk();
  };
  JobOnStringBufferSender.prototype.go = function () {
    var ok = this.okToGo();
    if (!ok.ok) {
      return ok.val;
    }
    this.jobProc();
    return ok.val;
  };

  function SubStringBufferSender (sbsender, string, defer) {
    JobOnStringBufferSender.call(this, sbsender, defer);
    this.string = string;
    this.lastsentnotifier = null;
  }
  lib.inherit(SubStringBufferSender, JobOnStringBufferSender);
  SubStringBufferSender.prototype.destroy = function () {
    this.lastsentnotifier = null;
    this.string = null;
    JobOnStringBufferSender.prototype.destroy.call(this);
  };
  SubStringBufferSender.prototype.jobProc = function () {
    this.destroyable.sendingfunc(this.string).then(
      this.onSent.bind(this),
      this.reject.bind(this)
    );
  };
  SubStringBufferSender.prototype.onSent = function (res) {
    if (this.lastsentnotifier) {
      this.lastsentnotifier();
    }
    this.resolve(res);
  };

  /*
  function StringBufferSenderResolver (sbsender, defer) {
    JobOnStringBufferSender.call(this, sbsender, defer);
  }
  lib.inherit(StringBufferSenderResolver, JobOnStringBufferSender);
  StringBufferSenderResolver.prototype.jobProc = function () {
    this.destroyable.resolve(true);
  };
  */

  mylib.StringBufferSender = StringBufferSender;
}
module.exports = createSignalRJobs;
