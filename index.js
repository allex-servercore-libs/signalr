function createSignalRLib (execlib) {
  'use strict';
  var lib = execlib.lib,
    timerlib = require('allex_timerlib')(execlib),
    mylib = {};

  require('./utilscreator')(lib, mylib);
  require('./jobscreator')(lib, mylib);
  require('./handlercreator')(lib, mylib);
  require('./transportcreator')(lib, mylib);
  require('./lptransportcreator')(lib, mylib);
  require('./wstransportcreator')(lib, mylib, timerlib);
  require('./channelcreator')(lib, mylib, timerlib);

  return mylib;
}
module.exports = createSignalRLib;
