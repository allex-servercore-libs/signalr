var _signalrlib;

var mylib = {};

function createLib () {
  if (!_signalrlib) {
    _signalrlib = require('../../')(execlib);
  }
  return _signalrlib;
}

mylib.createLib = createLib;

require('./servercreator')(mylib);
require('./clientcreator')(mylib);
require('./serverclientpaircreator')(mylib);

module.exports = mylib;

