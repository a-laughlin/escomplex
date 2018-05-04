'use strict';

module.exports = function (thing) {
  if (typeof thing === 'undefined') {
    return [];
  }
  if (Array.isArray(thing)) {
    return thing;
  }
  return [thing];
};
