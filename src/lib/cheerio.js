!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.$$=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var _ = require('underscore'),
  utils = require('../utils'),
  isTag = utils.isTag,
  decode = utils.decode,
  encode = utils.encode,
  hasOwn = Object.prototype.hasOwnProperty,
  rspace = /\s+/,

  // Lookup table for coercing string data-* attributes to their corresponding
  // JavaScript primitives
  primitives = {
    null: null,
    true: true,
    false: false
  },

  // Attributes that are booleans
  rboolean = /^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i,
  // Matches strings that look like JSON objects or arrays
  rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/;


var setAttr = function(el, name, value) {
  if (typeof name === 'object') return _.extend(el.attribs, name);

  if (value === null) {
    removeAttribute(el, name);
  } else {
    el.attribs[name] = encode(value);
  }

  return el.attribs;
};

var attr = exports.attr = function(name, value) {
  // Set the value (with attr map support)
  if (typeof name === 'object' || value !== undefined) {
    if (_.isFunction(value)) {
      return this.each(function(i, el) {
        setAttr(el, name, value.call(this, i, el.attribs[name]));
      });
    }
    return this.each(function(i, el) {
      el.attribs = setAttr(el, name, value);
    });
  }

  var elem = this[0];

  if (!elem || !isTag(elem)) return;

  if (!elem.attribs) {
    elem.attribs = {};
  }

  // Return the entire attribs object if no attribute specified
  if (!name) {
    for (var a in elem.attribs) {
      elem.attribs[a] = decode(elem.attribs[a]);
    }
    return elem.attribs;
  }

  if (hasOwn.call(elem.attribs, name)) {
    // Get the (decoded) attribute
    return decode(elem.attribs[name]);
  }
};

var setData = function(el, name, value) {
  if (typeof name === 'object') return _.extend(el.data, name);
  if (typeof name === 'string' && value !== undefined) {
    el.data[name] = encode(value);
  } else if (typeof name === 'object') {
    // If its an object, loop through it
    _.each(name, function(value, key) {
      el.data[key] = encode(value);
    });
  }

  return el.data;
};

var data = exports.data = function(name, value) {
  var elem = this[0];

  if (!elem || !isTag(elem)) return;

  if (!elem.data) {
    elem.data = {};
  }

  // Return the entire data object if no data specified
  if (!name) {

    _.each(elem.data, function(value, key) {
      elem.data[key] = decode(value);
    });

    return elem.data;
  }

  // Set the value (with attr map support)
  if (typeof name === 'object' || value !== undefined) {
    this.each(function(i, el) {
      el.data = setData(el, name, value);
    });
    return this;
  } else if (hasOwn.call(elem.data, name)) {
    // Get the (decoded) data
    var val = decode(elem.data[name]);

    if (hasOwn.call(primitives, val)) {
      val = primitives[val];
    } else if (val === String(Number(val))) {
      val = Number(val);
    } else if (rbrace.test(val)) {
      val = JSON.parse(val);
    }

    return val;
  } else if (typeof name === 'string' && value === undefined) {
    return undefined;
  }

  return this;
};

/**
 * Get the value of an element
 */

var val = exports.val = function(value) {
  var querying = arguments.length === 0,
      element = this[0];

  if(!element) return;

  switch (element.name) {
    case 'textarea':
      return querying ? this.text() : this.each(function() {
        this.text(value);
      });
    case 'input':
      switch (this.attr('type')) {
        case 'radio':
          var queryString = 'input[type=radio][name=' + this.attr('name') + ']:checked';
          var parentEl, root;

          // Go up until we hit a form or root
          parentEl = this.closest('form');
          if (parentEl.length === 0) {
            root = (this.parents().last()[0] || this[0]).root;
            parentEl = this._make(root);
          }

          if (querying) {
            return parentEl.find(queryString).attr('value');
          } else {
            parentEl.find(':checked').removeAttr('checked');
            parentEl.find('input[type=radio][value="' + value + '"]').attr('checked', '');
            return this;
          }
          break;
        default:
          return querying ? this.attr('value') : this.each(function() {
            this.attr('value', value);
          });
      }
      return;
    case 'select':
      var option = this.find('option:selected'),
          returnValue;
      if (option === undefined) return undefined;
      if (!querying) {
        if (!this.attr().hasOwnProperty('multiple') && typeof value == 'object') {
          return this;
        }
        if (typeof value != 'object') {
          value = [value];
        }
        this.find('option').removeAttr('selected');
        for (var i = 0; i < value.length; i++) {
          this.find('option[value="' + value[i] + '"]').attr('selected', '');
        }
        return this;
      }
      returnValue = option.attr('value');
      if (this.attr().hasOwnProperty('multiple')) {
        returnValue = [];
        option.each(function() {
          returnValue.push(this.attr('value'));
        });
      }
      return returnValue;
    case 'option':
      if (!querying) {
        this.attr('value', value);
        return this;
      }
      return this.attr('value');
  }
};

/**
 * Remove an attribute
 */

var removeAttribute = function(elem, name) {
  if (!isTag(elem.type) || !elem.attribs || !Object.hasOwnProperty.call(elem.attribs, name))
    return;

  if (rboolean.test(elem.attribs[name]))
    elem.attribs[name] = false;
  else
    delete elem.attribs[name];
};


var removeAttr = exports.removeAttr = function(name) {
  this.each(function(i, elem) {
    removeAttribute(elem, name);
  });

  return this;
};

var hasClass = exports.hasClass = function(className) {
  return _.any(this, function(elem) {
    var attrs = elem.attribs;
    return attrs && _.contains((attrs['class'] || '').split(rspace), className);
  });
};

var addClass = exports.addClass = function(value) {
  // Support functions
  if (_.isFunction(value)) {
    this.each(function(i) {
      var className = this.attr('class') || '';
      this.addClass(value.call(this[0], i, className));
    });
  }

  // Return if no value or not a string or function
  if (!value || !_.isString(value)) return this;

  var classNames = value.split(rspace),
      numElements = this.length,
      numClasses,
      setClass,
      $elem;


  for (var i = 0; i < numElements; i++) {
    $elem = this._make(this[i]);
    // If selected element isnt a tag, move on
    if (!isTag(this[i])) continue;

    // If we don't already have classes
    if (!$elem.attr('class')) {
      $elem.attr('class', classNames.join(' ').trim());
    } else {
      setClass = ' ' + $elem.attr('class') + ' ';
      numClasses = classNames.length;

      // Check if class already exists
      for (var j = 0; j < numClasses; j++) {
        if (!~setClass.indexOf(' ' + classNames[j] + ' '))
          setClass += classNames[j] + ' ';
      }

      $elem.attr('class', setClass.trim());
    }
  }

  return this;
};

var removeClass = exports.removeClass = function(value) {
  var split = function(className) {
    return className ? className.trim().split(rspace) : [];
  };
  var classes, removeAll;

  // Handle if value is a function
  if (_.isFunction(value)) {
    return this.each(function(i, el) {
      this.removeClass(value.call(this[0], i, el.attribs['class'] || ''));
    });
  }

  classes = split(value);
  removeAll = arguments.length === 0;

  return this.each(function(i, el) {
    if (!isTag(el)) return;
    el.attribs.class = removeAll ?
      '' :
      _.difference(split(el.attribs.class), classes).join(' ');
  });
};

var toggleClass = exports.toggleClass = function(value, stateVal) {
  // Support functions
  if (_.isFunction(value)) {
    return this.each(function(i, el) {
      this.toggleClass(value.call(this, i, el.attribs['class'] || '', stateVal), stateVal);
    });
  }

  // Return if no value or not a string or function
  if (!value || !_.isString(value)) return this;

  var classNames = value.split(rspace),
    numClasses = classNames.length,
    isBool = typeof stateVal === 'boolean',
    numElements = this.length,
    $elem,
    state;

  for (var i = 0; i < numElements; i++) {
    $elem = this._make(this[i]);
    // If selected element isnt a tag, move on
    if (!isTag(this[i])) continue;

    // Check if class already exists
    for (var j = 0; j < numClasses; j++) {
      // check each className given, space separated list
      state = isBool ? stateVal : !$elem.hasClass(classNames[j]);
      $elem[state ? 'addClass' : 'removeClass'](classNames[j]);
    }
  }

  return this;
};

var is = exports.is = function (selector) {
  if (selector) {
    return this.filter(selector).length > 0;
  }
  return false;
};


},{"../utils":9,"underscore":44}],2:[function(require,module,exports){
var _ = require('underscore');
var toString = Object.prototype.toString;

/**
 * Set / Get css.
 *
 * @param {String|Object} prop
 * @param {String} val
 * @return {self}
 * @api public
 */

exports.css = function(prop, val) {
  if (arguments.length === 2 ||
    // When `prop` is a "plain" object
    (toString.call(prop) === '[object Object]')) {
    return this.each(function(idx) {
      this._setCss(prop, val, idx);
    });
  } else {
    return this._getCss(prop);
  }
};

/**
 * Set styles of all elements.
 *
 * @param {String|Object} prop
 * @param {String} val
 * @param {Number} idx - optional index within the selection
 * @return {self}
 * @api private
 */

exports._setCss = function(prop, val, idx) {
  if ('string' == typeof prop) {
    var styles = this._getCss();
    if (_.isFunction(val)) {
      val = val.call(this[0], idx, this[0]);
    }

    if (val === '') {
      delete styles[prop];
    } else if (val != null) {
      styles[prop] = val;
    }

    return this.attr('style', stringify(styles));
  } else if ('object' == typeof prop) {
    Object.keys(prop).forEach(function(k){
      this._setCss(k, prop[k]);
    }, this);
    return this;
  }
};

/**
 * Get parsed styles of the first element.
 *
 * @param {String} prop
 * @return {Object}
 * @api private
 */

exports._getCss = function(prop) {
  var styles = parse(this.attr('style'));
  if (typeof prop === 'string') {
    return styles[prop];
  } else if (_.isArray(prop)) {
    return _.pick(styles, prop);
  } else {
    return styles;
  }
};

/**
 * Stringify `obj` to styles.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function stringify(obj) {
  return Object.keys(obj || {})
    .reduce(function(str, prop){
      return str += ''
        + (str ? ' ' : '')
        + prop
        + ': '
        + obj[prop]
        + ';';
    }, '');
}

/**
 * Parse `styles`.
 *
 * @param {String} styles
 * @return {Object}
 * @api private
 */

function parse(styles) {
  styles = (styles || '').trim();

  if (!styles) return {};

  return styles
    .split(';')
    .reduce(function(obj, str){
      var n = str.indexOf(':');
      // skip if there is no :, or if it is the first/last character
      if (n < 1 || n === str.length-1) return obj;
      obj[str.slice(0,n).trim()] = str.slice(n+1).trim();
      return obj;
    }, {});
}

},{"underscore":44}],3:[function(require,module,exports){
var _ = require('underscore'),
    parse = require('../parse'),
    $ = require('../static'),
    updateDOM = parse.update,
    evaluate = parse.evaluate,
    encode = require('../utils').encode,
    slice = Array.prototype.slice;

// Create an array of nodes, recursing into arrays and parsing strings if
// necessary
var makeDomArray = function(elem) {
  if (elem == null) {
    return [];
  } else if (elem.cheerio) {
    return elem.toArray();
  } else if (_.isArray(elem)) {
    return _.flatten(elem.map(makeDomArray));
  } else if (_.isString(elem)) {
    return evaluate(elem);
  } else {
    return [elem];
  }
};

var _insert = function(concatenator) {
  return function() {
    var elems = slice.call(arguments),
        dom = makeDomArray(elems);

    return this.each(function(i, el) {
      if (_.isFunction(elems[0])) {
        dom = makeDomArray(elems[0].call(el, i, this.html()));
      }
      updateDOM(concatenator(dom, el.children || (el.children = [])), el);
    });
  };
};

var append = exports.append = _insert(function(dom, children) {
  return children.concat(dom);
});

var prepend = exports.prepend = _insert(function(dom, children) {
  return dom.concat(children);
});

var after = exports.after = function() {
  var elems = slice.call(arguments),
      dom = makeDomArray(elems);

  this.each(function(i, el) {
    var parent = el.parent || el.root,
        siblings = parent.children,
        index = siblings.indexOf(el);

    // If not found, move on
    if (!~index) return;

    if (_.isFunction(elems[0])) {
      dom = makeDomArray(elems[0].call(el, i));
    }

    // Add element after `this` element
    siblings.splice.apply(siblings, [++index, 0].concat(dom));

    // Update next, prev, and parent pointers
    updateDOM(siblings, parent);
  });

  return this;
};

var before = exports.before = function() {
  var elems = slice.call(arguments),
      dom = makeDomArray(elems);

  this.each(function(i, el) {
    var parent = el.parent || el.root,
        siblings = parent.children,
        index = siblings.indexOf(el);

    // If not found, move on
    if (!~index) return;

    if (_.isFunction(elems[0])) {
      dom = makeDomArray(elems[0].call(el, i));
    }

    // Add element before `el` element
    siblings.splice.apply(siblings, [index, 0].concat(dom));

    // Update next, prev, and parent pointers
    updateDOM(siblings, parent);
  });

  return this;
};

/*
  remove([selector])
*/
var remove = exports.remove = function(selector) {
  var elems = this;

  // Filter if we have selector
  if (selector)
    elems = elems.filter(selector);

  elems.each(function(i, el) {
    var parent = el.parent || el.root,
        siblings = parent.children,
        index = siblings.indexOf(el);

    if (!~index) return;

    siblings.splice(index, 1);

    // Update next, prev, and parent pointers
    updateDOM(siblings, parent);
  });

  return this;
};

var replaceWith = exports.replaceWith = function(content) {
  var dom = makeDomArray(content);

  this.each(function(i, el) {
    var parent = el.parent || el.root,
        siblings = parent.children,
        index;

    if (_.isFunction(content)) {
      dom = makeDomArray(content.call(el, i));
    }

    // In the case that `dom` contains nodes that already exist in other
    // structures, ensure those nodes are properly removed.
    updateDOM(dom, null);

    index = siblings.indexOf(el);

    // Completely remove old element
    siblings.splice.apply(siblings, [index, 1].concat(dom));
    el.parent = el.prev = el.next = null;

    updateDOM(siblings, parent);
  });

  return this;
};

var empty = exports.empty = function() {
  this.each(function(i, el) {
    el.children = [];
  });
  return this;
};

/**
 * Set/Get the HTML
 */
var html = exports.html = function(str) {
  if (str === undefined) {
    if (!this[0] || !this[0].children) return null;
    return $.html(this[0].children);
  }

  str = str.cheerio ? str.toArray() : evaluate(str);

  this.each(function(i, el) {
    el.children = str;
    updateDOM(el.children, el);
  });

  return this;
};

var toString = exports.toString = function() {
  return $.html(this);
};

var text = exports.text = function(str) {
  // If `str` is undefined, act as a "getter"
  if (str === undefined) {
    return $.text(this);
  } else if (_.isFunction(str)) {
    // Function support
    return this.each(function(i, el) {
      return this.text(str.call(el, i, this.text()));
    });
  }

  var elem = {
    data: encode(str),
    type: 'text',
    parent: null,
    prev: null,
    next: null,
    children: []
  };

  // Append text node to each selected elements
  this.each(function(i, el) {
    el.children = elem;
    updateDOM(el.children, el);
  });

  return this;
};

var clone = exports.clone = function() {
  // Turn it into HTML, then recreate it,
  // Seems to be the easiest way to reconnect everything correctly
  return this._make($.html(this));
};

},{"../parse":6,"../static":8,"../utils":9,"underscore":44}],4:[function(require,module,exports){
var _ = require('underscore'),
    select = require('CSSselect'),
    utils = require('../utils'),
    isTag = utils.isTag;

var find = exports.find = function(selector) {
  return this._make(select(selector, [].slice.call(this.children())));
};

// Get the parent of each element in the current set of matched elements,
// optionally filtered by a selector.
var parent = exports.parent = function(selector) {
  var set = [];
  var $set;

  this.each(function(idx, elem) {
    var parentElem = elem.parent;
    if (parentElem && set.indexOf(parentElem) < 0) {
      set.push(parentElem);
    }
  });

  $set = this._make(set);

  if (arguments.length) {
    $set = $set.filter(selector);
  }

  return $set;
};

var parents = exports.parents = function(selector) {
  var parentNodes = [];

  // When multiple DOM elements are in the original set, the resulting set will
  // be in *reverse* order of the original elements as well, with duplicates
  // removed.
  this.toArray().reverse().forEach(function(elem) {
    traverseParents(this, elem.parent, selector, Infinity)
      .forEach(function(node) {
        if (parentNodes.indexOf(node) === -1) {
          parentNodes.push(node);
        }
      }
    );
  }, this);

  return this._make(parentNodes);
};

// For each element in the set, get the first element that matches the selector
// by testing the element itself and traversing up through its ancestors in the
// DOM tree.
var closest = exports.closest = function(selector) {
  var set = [];

  if (!selector) {
    return this._make(set);
  }

  this.each(function(idx, elem) {
    var closestElem = traverseParents(this, elem, selector, 1)[0];

    // Do not add duplicate elements to the set
    if (closestElem && set.indexOf(closestElem) < 0) {
      set.push(closestElem);
    }
  }.bind(this));

  return this._make(set);
};

var next = exports.next = function() {
  if (!this[0]) { return this; }
  var elems = [];

  _.forEach(this, function(elem) {
    while ((elem = elem.next)) {
      if (isTag(elem)) {
        elems.push(elem);
        return;
      }
    }
  });

  return this._make(elems);
};

var nextAll = exports.nextAll = function(selector) {
  if (!this[0]) { return this; }
  var elems = [];

  _.forEach(this, function(elem) {
    while ((elem = elem.next)) {
      if (isTag(elem) && elems.indexOf(elem) === -1) {
        elems.push(elem);
      }
    }
  });

  return this._make(selector ? select(selector, elems) : elems);
};

var nextUntil = exports.nextUntil = function(selector, filter) {
  if (!this[0]) { return this; }
  var elems = [], untilNode, untilNodes;

  if (typeof selector === 'string') {
    untilNode = select(selector, this.nextAll().toArray())[0];
  } else if (selector && selector.cheerio) {
    untilNodes = selector.toArray();
  } else if (selector) {
    untilNode = selector;
  }

  _.forEach(this, function(elem) {
    while ((elem = elem.next)) {
      if ((untilNode && elem !== untilNode) ||
        (untilNodes && untilNodes.indexOf(elem) === -1) ||
        (!untilNode && !untilNodes)) {
        if (isTag(elem) && elems.indexOf(elem) === -1) {
          elems.push(elem);
        }
      } else {
        break;
      }
    }
  });

  return this._make(filter ? select(filter, elems) : elems);
};

var prev = exports.prev = function() {
  if (!this[0]) { return this; }
  var elems = [];

  _.forEach(this, function(elem) {
    while ((elem = elem.prev)) {
      if (isTag(elem)) {
        elems.push(elem);
        return;
      }
    }
  });

  return this._make(elems);
};

var prevAll = exports.prevAll = function(selector) {
  if (!this[0]) { return this; }
  var elems = [];

  _.forEach(this, function(elem) {
    while ((elem = elem.prev)) {
      if (isTag(elem) && elems.indexOf(elem) === -1) {
        elems.push(elem);
      }
    }
  });

  return this._make(selector ? select(selector, elems) : elems);
};

var prevUntil = exports.prevUntil = function(selector, filter) {
  if (!this[0]) { return this; }
  var elems = [], untilNode, untilNodes;

  if (typeof selector === 'string') {
    untilNode = select(selector, this.prevAll().toArray())[0];
  } else if (selector && selector.cheerio) {
    untilNodes = selector.toArray();
  } else if (selector) {
    untilNode = selector;
  }

  _.forEach(this, function(elem) {
    while ((elem = elem.prev)) {
      if ((untilNode && elem !== untilNode) ||
        (untilNodes && untilNodes.indexOf(elem) === -1) ||
        (!untilNode && !untilNodes)) {
        if (isTag(elem) && elems.indexOf(elem) === -1) {
          elems.push(elem);
        }
      } else {
        break;
      }
    }
  });

  return this._make(filter ? select(filter, elems) : elems);
};

var siblings = exports.siblings = function(selector) {
  var elems = _.filter(
    this.parent() ? this.parent().children() : this.siblingsAndMe(),
    function(elem) { return isTag(elem) && !this.is(elem); },
    this
  );
  if (selector !== undefined) {
    elems = this._make(select(selector, elems));
  }
  return this._make(elems);
};

var children = exports.children = function(selector) {

  var elems = _.reduce(this, function(memo, elem) {
    return memo.concat(_.filter(elem.children, isTag));
  }, []);

  if (selector === undefined) return this._make(elems);
  else if (_.isNumber(selector)) return this._make(elems[selector]);

  return this._make(elems).filter(selector);
};

var contents = exports.contents = function() {
  return this._make(_.reduce(this, function(all, elem) {
    all.push.apply(all, elem.children);
    return all;
  }, []));
};

var each = exports.each = function(fn) {
  var i = 0, len = this.length;
  while (i < len && fn.call(this._make(this[i]), i, this[i]) !== false) ++i;
  return this;
};

var map = exports.map = function(fn) {
  return this._make(_.reduce(this, function(memo, el, i) {
    var val = fn.call(el, i, el);
    return val == null ? memo : memo.concat(val);
  }, []));
};

var filter = exports.filter = function(match) {
  var make = _.bind(this._make, this);
  var filterFn;

  if (_.isString(match)) {
    filterFn = function(el) {
      return select(match, [el])[0] === el;
    };
  } else if (_.isFunction(match)) {
    filterFn = function(el, i) {
      return match.call(make(el), i, el);
    };
  } else if (match.cheerio) {
    filterFn = match.is.bind(match);
  } else {
    filterFn = function(el) {
      return match === el;
    };
  }

  return make(_.filter(this, filterFn));
};

var first = exports.first = function() {
  return this[0] ? this._make(this[0]) : this;
};

var last = exports.last = function() {
  return this[0] ? this._make(this[this.length - 1]) : this;
};

// Reduce the set of matched elements to the one at the specified index.
var eq = exports.eq = function(i) {
  i = +i;
  if (i < 0) i = this.length + i;
  return this[i] ? this._make(this[i]) : this._make([]);
};

var slice = exports.slice = function() {
  return this._make([].slice.apply(this, arguments));
};

function traverseParents(self, elem, selector, limit) {
  var elems = [];
  while (elem && elems.length < limit) {
    if (!selector || self._make(elem).filter(selector).length) {
      elems.push(elem);
    }
    elem = elem.parent;
  }
  return elems;
}

// End the most recent filtering operation in the current chain and return the
// set of matched elements to its previous state.
var end = exports.end = function() {
  return this.prevObject || this._make([]);
};

},{"../utils":9,"CSSselect":10,"underscore":44}],5:[function(require,module,exports){
/*
  Module dependencies
*/

var path = require('path'),
    parse = require('./parse'),
    evaluate = parse.evaluate,
    _ = require('underscore');

/*
 * The API
 */

var api = ['attributes', 'traversing', 'manipulation', 'css'];

/*
 * A simple way to check for HTML strings or ID strings
 */

var quickExpr = /^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/;

/**
 * Static Methods
 */

var $ = require('./static');

/*
 * Instance of cheerio
 */

var Cheerio = module.exports = function(selector, context, root) {
  if (!(this instanceof Cheerio)) return new Cheerio(selector, context, root);

  // $(), $(null), $(undefined), $(false)
  if (!selector) return this;

  if (root) {
    if (typeof root === 'string') root = parse(root);
    this._root = Cheerio.call(this, root);
  }

  // $($)
  if (selector.cheerio) return selector;

  // $(dom)
  if (selector.name || selector.type === 'text' || selector.type === 'comment')
    selector = [selector];

  // $([dom])
  if (Array.isArray(selector)) {
    _.forEach(selector, function(elem, idx) {
      this[idx] = elem;
    }, this);
    this.length = selector.length;
    return this;
  }

  // $(<html>)
  if (typeof selector === 'string' && isHtml(selector)) {
    return Cheerio.call(this, parse(selector).children);
  }

  // If we don't have a context, maybe we have a root, from loading
  if (!context) {
    context = this._root;
  } else if (typeof context === 'string') {
    if (isHtml(context)) {
      // $('li', '<ul>...</ul>')
      context = parse(context);
      context = Cheerio.call(this, context);
    } else {
      // $('li', 'ul')
      selector = [context, selector].join(' ');
      context = this._root;
    }
  }

  // If we still don't have a context, return
  if (!context) return this;

  // #id, .class, tag
  return context.find(selector);
};

/**
 * Mix in `static`
 */

_.extend(Cheerio, require('./static'));

/*
 * Set a signature of the object
 */

Cheerio.prototype.cheerio = '[cheerio object]';

/*
 * Cheerio default options
 */

Cheerio.prototype.options = {
  normalizeWhitespace: false,
  xmlMode: false,
  lowerCaseTags: false
};

/*
 * Make cheerio an array-like object
 */

Cheerio.prototype.length = 0;
Cheerio.prototype.splice = Array.prototype.splice;

/*
 * Check if string is HTML
 */
var isHtml = function(str) {
  // Faster than running regex, if str starts with `<` and ends with `>`, assume it's HTML
  if (str.charAt(0) === '<' && str.charAt(str.length - 1) === '>' && str.length >= 3) return true;

  // Run the regex
  var match = quickExpr.exec(str);
  return !!(match && match[1]);
};

/*
 * Make a cheerio object
 *
 * @api private
 */

Cheerio.prototype._make = function(dom) {
  var cheerio = new Cheerio(dom);
  cheerio.prevObject = this;
  return cheerio;
};

/**
 * Turn a cheerio object into an array
 */

Cheerio.prototype.toArray = function() {
  return [].slice.call(this, 0);
};

/**
 * Plug in the API
api.forEach(function(mod) {
  _.extend(Cheerio.prototype, require('./api/' + mod));
});
 */

_apimods = [require('./api/attributes'), require('./api/traversing'),
require('./api/manipulation'), require('./api/css')];
_apimods.forEach(function(mod) {
    _.extend(Cheerio.prototype, mod);
});

},{"./api/attributes":1,"./api/css":2,"./api/manipulation":3,"./api/traversing":4,"./parse":6,"./static":8,"path":50,"underscore":44}],6:[function(require,module,exports){
/*
  Module Dependencies
*/
var htmlparser = require('htmlparser2'),
    _ = require('underscore'),
    isTag = require('./utils').isTag,
    camelCase = require('./utils').camelCase;

/*
  Parser
*/
exports = module.exports = function(content, options) {
  var dom = evaluate(content, options);

  // Generic root element
  var root = {
    type: 'root',
    name: 'root',
    parent: null,
    prev: null,
    next: null,
    children: []
  };

  // Update the dom using the root
  update(dom, root);

  return root;
};

var evaluate = exports.evaluate = function(content, options) {
  // options = options || $.fn.options;

  var handler = new htmlparser.DomHandler(options),
      parser = new htmlparser.Parser(handler, options);

  parser.write(content);
  parser.done();

  _.forEach(handler.dom, parseData);

  return handler.dom;
};

/*
  Update the dom structure, for one changed layer
*/
var update = exports.update = function(arr, parent) {
  // normalize
  if (!Array.isArray(arr)) arr = [arr];

  // Update parent
  if (parent) {
    parent.children = arr;
  } else {
    parent = null;
  }

  // Update neighbors
  for (var i = 0; i < arr.length; i++) {
    var node = arr[i];

    // Cleanly remove existing nodes from their previous structures.
    var oldSiblings = node.parent && node.parent.children;
    if (oldSiblings && oldSiblings !== arr) {
      oldSiblings.splice(oldSiblings.indexOf(node), 1);
      if (node.prev) {
        node.prev.next = node.next;
      }
      if (node.next) {
        node.next.prev = node.prev;
      }
    }

    node.prev = arr[i - 1] || null;
    node.next = arr[i + 1] || null;

    if (parent && parent.type === 'root') {
      node.root = parent;
      node.parent = null;
    } else {
      delete node.root;
      node.parent = parent;
    }
  }

  return parent;
};

/**
 * Extract element data according to `data-*` element attributes and store in
 * a key-value hash on the element's `data` attribute. Repeat for any and all
 * descendant elements.
 *
 * @param  {Object} elem Element
 */
var parseData = exports.parseData = function(elem) {
  if (elem.data === undefined) elem.data = {};
  var value;
  for (var key in elem.attribs) {
    if (key.substr(0, 5) === 'data-') {
      value = elem.attribs[key];
      key = key.slice(5);
      key = camelCase(key);
      elem.data[key] = value;
    }
  }

  _.forEach(elem.children, parseData);
};

// module.exports = $.extend(exports);

},{"./utils":9,"htmlparser2":40,"underscore":44}],7:[function(require,module,exports){
/*
  Module dependencies
*/
var _ = require('underscore');
var utils = require('./utils');

var decode = utils.decode;
var encode = utils.encode;

/*
  Boolean Attributes
*/
var rboolean = /^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i;

/*
  Format attributes
*/
var formatAttrs = function(attributes) {
  if (!attributes) return '';

  var output = [],
      value;

  // Loop through the attributes
  for (var key in attributes) {
    value = attributes[key];
    if (!value && (rboolean.test(key) || key === '/')) {
      output.push(key);
    } else {
      output.push(key + '="' + encode(decode(value)) + '"');
    }
  }

  return output.join(' ');
};

/*
  Self-enclosing tags (stolen from node-htmlparser)
*/
var singleTag = {
  area: 1,
  base: 1,
  basefont: 1,
  br: 1,
  col: 1,
  frame: 1,
  hr: 1,
  img: 1,
  input: 1,
  isindex: 1,
  link: 1,
  meta: 1,
  param: 1,
  embed: 1,
  include: 1,
  'yield': 1
};

/*
  Tag types from htmlparser
*/
var tagType = {
  tag: 1,
  script: 1,
  link: 1,
  style: 1,
  template: 1
};

var render = module.exports = function(dom, opts) {
  if (!Array.isArray(dom) && !dom.cheerio) dom = [dom];
  opts = opts || {};

  var output = [],
      xmlMode = opts.xmlMode || false;

  _.each(dom, function(elem) {
    var pushVal;

    if (tagType[elem.type])
      pushVal = renderTag(elem, xmlMode);
    else if (elem.type === 'directive')
      pushVal = renderDirective(elem);
    else if (elem.type === 'comment')
      pushVal = renderComment(elem);
    else
      pushVal = renderText(elem);

    // Push rendered DOM node
    output.push(pushVal);

    if (elem.children)
      output.push(render(elem.children, opts));

    if ((!singleTag[elem.name] || xmlMode) && tagType[elem.type]) {
      if (!isClosedTag(elem, xmlMode)) {
        output.push('</' + elem.name + '>');
      }
    }
  });

  return output.join('');
};

var isClosedTag = function(elem, xmlMode){
  return (xmlMode && (!elem.children || elem.children.length === 0));
};

var renderTag = function(elem, xmlMode) {
  var tag = '<' + elem.name;

  if (elem.attribs && _.size(elem.attribs)) {
    tag += ' ' + formatAttrs(elem.attribs);
  }

  if (isClosedTag(elem, xmlMode)) {
    tag += '/';
  }

  return tag + '>';
};

var renderDirective = function(elem) {
  return '<' + elem.data + '>';
};

var renderText = function(elem) {
  return elem.data;
};

var renderComment = function(elem) {
  return '<!--' + elem.data + '-->';
};

// module.exports = $.extend(exports);

},{"./utils":9,"underscore":44}],8:[function(require,module,exports){
/**
 * Module dependencies
 */

var select = require('CSSselect'),
    parse = require('./parse'),
    render = require('./render'),
    decode = require('./utils').decode;

/**
 * $.load(str)
 */

var load = exports.load = function(str, options) {
  var Cheerio = require('./cheerio'),
      root = parse(str, options);

  var initialize = function(selector, context, r) {
    return new Cheerio(selector, context, r || root);
  };

  // Add in the static methods
  initialize.__proto__ = exports;

  // Add in the root
  initialize._root = root;

  return initialize;
};

/**
 * $.html([selector | dom])
 */

var html = exports.html = function(dom) {
  if (dom) {
    dom = (typeof dom === 'string') ? select(dom, this._root) : dom;
    return render(dom);
  } else if (this._root && this._root.children) {
    return render(this._root.children);
  } else {
    return '';
  }
};

/**
 * $.xml([selector | dom])
 */

var xml = exports.xml = function(dom) {
  if (dom) {
    dom = (typeof dom === 'string') ? select(dom, this._root) : dom;
    return render(dom, { xmlMode: true });
  } else if (this._root && this._root.children) {
    return render(this._root.children, { xmlMode: true });
  } else {
    return '';
  }
};

/**
 * $.text(dom)
 */

var text = exports.text = function(elems) {
  if (!elems) return '';

  var ret = '',
      len = elems.length,
      elem;

  for (var i = 0; i < len; i ++) {
    elem = elems[i];
    if (elem.type === 'text') ret += decode(elem.data);
    else if (elem.children && elem.type !== 'comment') {
      ret += text(elem.children);
    }
  }

  return ret;
};

/**
 * $.parseHTML(data [, context ] [, keepScripts ])
 * Parses a string into an array of DOM nodes. The `context` argument has no
 * meaning for Cheerio, but it is maintained for API compatability with jQuery.
 */
var parseHTML = exports.parseHTML = function(data, context, keepScripts) {
  var parsed;

  if (!data || typeof data !== 'string') {
    return null;
  }

  if (typeof context === 'boolean') {
    keepScripts = context;
  }

  parsed = this.load(data);
  if (!keepScripts) {
    parsed('script').remove();
  }

  return parsed.root()[0].children;
};

/**
 * $.root()
 */
var root = exports.root = function() {
  return this(this._root);
};

/**
 * $.contains()
 */
var contains = exports.contains = function(container, contained) {

  // According to the jQuery API, an element does not "contain" itself
  if (contained === container) {
    return false;
  }

  // Step up the descendents, stopping when the root element is reached
  // (signaled by `.parent` returning a reference to the same object)
  while (contained && contained !== contained.parent) {
    contained = contained.parent;
    if (contained === container) {
      return true;
    }
  }

  return false;
};

},{"./cheerio":5,"./parse":6,"./render":7,"./utils":9,"CSSselect":10}],9:[function(require,module,exports){
/**
 * Module Dependencies
 */
var entities = require('entities');

/**
 * HTML Tags
 */

var tags = { tag: true, script: true, style: true };

/**
 * Check if the DOM element is a tag
 *
 * isTag(type) includes <script> and <style> tags
 */

exports.isTag = function(type) {
  if (type.type) type = type.type;
  return tags[type] || false;
};

/**
 * Convert a string to camel case notation.
 * @param  {String} str String to be converted.
 * @return {String}     String in camel case notation.
 */

exports.camelCase = function(str) {
  return str.replace(/[_.-](\w|$)/g, function(_, x) {
    return x.toUpperCase();
  });
};

/**
 * Expose encode and decode methods from FB55's node-entities library
 *
 * 0 = XML, 1 = HTML4 and 2 = HTML5
 */

exports.encode = function(str) { return entities.encode(String(str), 0); };
exports.decode = function(str) { return entities.decode(str, 2); };

},{"entities":30}],10:[function(require,module,exports){
"use strict";

module.exports = CSSselect;

var Pseudos       = require("./lib/pseudos.js"),
    DomUtils      = require("domutils"),
    findOne       = DomUtils.findOne,
    findAll       = DomUtils.findAll,
    getChildren   = DomUtils.getChildren,
    removeSubsets = DomUtils.removeSubsets,
    falseFunc     = require("./lib/basefunctions.js").falseFunc,
    compile       = require("./lib/compile.js");

function getSelectorFunc(searchFunc){
	return function select(query, elems, options){
		if(typeof query !== "function") query = compile(query, options);
		if(!Array.isArray(elems)) elems = getChildren(elems);
		else elems = removeSubsets(elems);
		return searchFunc(query, elems);
	};
}

var selectAll = getSelectorFunc(function selectAll(query, elems){
	return (query === falseFunc || !elems || elems.length === 0) ? [] : findAll(query, elems);
});

var selectOne = getSelectorFunc(function selectOne(query, elems){
	return (query === falseFunc || !elems || elems.length === 0) ? null : findOne(query, elems);
});

function is(elem, query, options){
	return (typeof query === "function" ? query : compile(query, options))(elem);
}

/*
	the exported interface
*/
function CSSselect(query, elems, options){
	return selectAll(query, elems, options);
}

CSSselect.compile = compile;
CSSselect.filters = Pseudos.filters;
CSSselect.pseudos = Pseudos.pseudos;

CSSselect.selectAll = selectAll;
CSSselect.selectOne = selectOne;

CSSselect.is = is;

//legacy methods (might be removed)
CSSselect.parse = compile;
CSSselect.iterate = selectAll;

},{"./lib/basefunctions.js":12,"./lib/compile.js":13,"./lib/pseudos.js":16,"domutils":19}],11:[function(require,module,exports){
var DomUtils  = require("domutils"),
    hasAttrib = DomUtils.hasAttrib,
    getAttributeValue = DomUtils.getAttributeValue,
    falseFunc = require("./basefunctions.js").falseFunc;

//https://github.com/slevithan/XRegExp/blob/master/src/xregexp.js#L469
var reChars = /[-[\]{}()*+?.,\\^$|#\s]/g;

/*
	attribute selectors
*/

var attributeRules = {
	__proto__: null,
	equals: function(next, data){
		var name  = data.name,
		    value = data.value;

		if(data.ignoreCase){
			value = value.toLowerCase();

			return function(elem){
				var attr = getAttributeValue(elem, name);
				return attr != null && attr.toLowerCase() === value && next(elem);
			};
		}

		return function(elem){
			return getAttributeValue(elem, name) === value && next(elem);
		};
	},
	hyphen: function(next, data){
		var name  = data.name,
		    value = data.value,
		    len = value.length;

		if(data.ignoreCase){
			value = value.toLowerCase();

			return function(elem){
				var attr = getAttributeValue(elem, name);
				return attr != null &&
						(attr.length === len || attr.charAt(len) === "-") &&
						attr.substr(0, len).toLowerCase() === value &&
						next(elem);
			};
		}

		return function(elem){
			var attr = getAttributeValue(elem, name);
			return attr != null &&
					attr.substr(0, len) === value &&
					(attr.length === len || attr.charAt(len) === "-") &&
					next(elem);
		};
	},
	element: function(next, data){
		var name = data.name,
		    value = data.value;

		if(/\s/.test(value)){
			return falseFunc;
		}

		value = value.replace(reChars, "\\$&");

		var pattern = "(?:^|\\s)" + value + "(?:$|\\s)",
		    flags = data.ignoreCase ? "i" : "",
		    regex = new RegExp(pattern, flags);

		return function(elem){
			var attr = getAttributeValue(elem, name);
			return attr != null && regex.test(attr) && next(elem);
		};
	},
	exists: function(next, data){
		var name = data.name;
		return function(elem){
			return hasAttrib(elem, name) && next(elem);
		};
	},
	start: function(next, data){
		var name  = data.name,
		    value = data.value,
		    len = value.length;

		if(len === 0){
			return falseFunc;
		}
		
		if(data.ignoreCase){
			value = value.toLowerCase();

			return function(elem){
				var attr = getAttributeValue(elem, name);
				return attr != null && attr.substr(0, len).toLowerCase() === value && next(elem);
			};
		}

		return function(elem){
			var attr = getAttributeValue(elem, name);
			return attr != null && attr.substr(0, len) === value && next(elem);
		};
	},
	end: function(next, data){
		var name  = data.name,
		    value = data.value,
		    len   = -value.length;

		if(len === 0){
			return falseFunc;
		}

		if(data.ignoreCase){
			value = value.toLowerCase();

			return function(elem){
				var attr = getAttributeValue(elem, name);
				return attr != null && attr.substr(len).toLowerCase() === value && next(elem);
			};
		}

		return function(elem){
			var attr = getAttributeValue(elem, name);
			return attr != null && attr.substr(len) === value && next(elem);
		};
	},
	any: function(next, data){
		var name  = data.name,
		    value = data.value;

		if(value === ""){
			return falseFunc;
		}

		if(data.ignoreCase){
			var regex = new RegExp(value.replace(reChars, "\\$&"), "i");

			return function(elem){
				var attr = getAttributeValue(elem, name);
				return attr != null && regex.test(attr) && next(elem);
			};
		}

		return function(elem){
			var attr = getAttributeValue(elem, name);
			return attr != null && attr.indexOf(value) >= 0 && next(elem);
		};
	},
	not: function(next, data){
		var name  = data.name,
		    value = data.value;

		if(value === ""){
			return function(elem){
				return !!getAttributeValue(elem, name) && next(elem);
			};
		} else if(data.ignoreCase){
			value = value.toLowerCase();

			return function(elem){
				var attr = getAttributeValue(elem, name);
				return attr != null && attr.toLowerCase() !== value && next(elem);
			};
		}

		return function(elem){
			return getAttributeValue(elem, name) !== value && next(elem);
		};
	}
};

module.exports = {
	compile: function(next, data){
		return attributeRules[data.action](next, data);
	},
	rules: attributeRules
};

},{"./basefunctions.js":12,"domutils":19}],12:[function(require,module,exports){
module.exports = {
	trueFunc: function trueFunc(){
		return true;
	},
	falseFunc: function falseFunc(){
		return false;
	}
};
},{}],13:[function(require,module,exports){
/*
	compiles a selector to an executable function
*/

module.exports = compile;

var parse       = require("CSSwhat"),
    DomUtils    = require("domutils"),
    isTag       = DomUtils.isTag,
    Rules       = require("./general.js"),
    sortRules   = require("./sort.js"),
    BaseFuncs   = require("./basefunctions.js"),
    trueFunc    = BaseFuncs.trueFunc,
    falseFunc   = BaseFuncs.falseFunc;

function compile(selector, options){
	var next = parse(selector, options)
		.map(compileRules)
		.reduce(reduceRules, falseFunc);

	return function(elem){
		return isTag(elem) && next(elem);
	};
}

function compileRules(arr){
	if(arr.length === 0) return falseFunc;
	return sortRules(arr).reduce(function(func, rule){
		if(func === falseFunc) return func;
		return Rules[rule.type](func, rule);
	}, trueFunc);
}

function reduceRules(a, b){
	if(b === falseFunc || a === trueFunc){
		return a;
	}
	if(a === falseFunc || b === trueFunc){
		return b;
	}

	return function combine(elem){
		return a(elem) || b(elem);
	};	
}

//:not and :has have to compile selectors
//doing this in lib/pseudos.js would lead to circular dependencies,
//so we add them here

var Pseudos     = require("./pseudos.js"),
    filters     = Pseudos.filters,
    isParent    = Pseudos.pseudos.parent,
    findOne     = DomUtils.findOne,
    getChildren = DomUtils.getChildren;

filters.not = function(next, select){
	var func = compile(select);

	if(func === falseFunc) return next;
	if(func === trueFunc)  return falseFunc;

	return function(elem){
		return !func(elem) && next(elem);
	};
};

filters.has = function(next, selector){
	var func = compile(selector);

	if(func === falseFunc) return falseFunc;
	if(func === trueFunc)  return function(elem){
			return isParent(elem) && next(elem);
		};

	return function has(elem){
		return next(elem) && findOne(func, getChildren(elem)) !== null;
	};
};

},{"./basefunctions.js":12,"./general.js":14,"./pseudos.js":16,"./sort.js":17,"CSSwhat":18,"domutils":19}],14:[function(require,module,exports){
var DomUtils    = require("domutils"),
    isTag       = DomUtils.isTag,
    getParent   = DomUtils.getParent,
    getChildren = DomUtils.getChildren,
    getSiblings = DomUtils.getSiblings,
    getName     = DomUtils.getName;

/*
	all available rules
*/
module.exports = {
	__proto__: null,

	attribute: require("./attributes.js").compile,
	pseudo: require("./pseudos.js").compile,

	//tags
	tag: function(next, data){
		var name = data.name;
		return function tag(elem){
			return getName(elem) === name && next(elem);
		};
	},

	//traversal
	descendant: function(next){
		return function descendant(elem){
			var found = false;

			while(!found && (elem = getParent(elem))){
				found = next(elem);
			}

			return found;
		};
	},
	parent: function(next){
		return function parent(elem){
			return getChildren(elem).some(next);
		};
	},
	child: function(next){
		return function child(elem){
			var parent = getParent(elem);
			return !!parent && next(parent);
		};
	},
	sibling: function(next){
		return function sibling(elem){
			var siblings = getSiblings(elem);

			for(var i = 0; i < siblings.length; i++){
				if(isTag(siblings[i])){
					if(siblings[i] === elem) break;
					if(next(siblings[i])) return true;
				}
			}

			return false;
		};
	},
	adjacent: function(next){
		return function adjacent(elem){
			var siblings = getSiblings(elem),
			    lastElement;

			for(var i = 0; i < siblings.length; i++){
				if(isTag(siblings[i])){
					if(siblings[i] === elem) break;
					lastElement = siblings[i];
				}
			}

			return !!lastElement && next(lastElement);
		};
	},
	universal: function(next){
		return next;
	}
};
},{"./attributes.js":11,"./pseudos.js":16,"domutils":19}],15:[function(require,module,exports){
var BaseFuncs = require("./basefunctions.js"),
    trueFunc  = BaseFuncs.trueFunc,
    falseFunc = BaseFuncs.falseFunc;

module.exports = function nthCheck(formula){
	return compile(parse(formula));
};

module.exports.parse = parse;
module.exports.compile = compile;

//following http://www.w3.org/TR/css3-selectors/#nth-child-pseudo

//[ ['-'|'+']? INTEGER? {N} [ S* ['-'|'+'] S* INTEGER ]?
var re_nthElement = /^([+\-]?\d*n)?\s*(?:([+\-]?)\s*(\d+))?$/;

/*
	parses a nth-check formula, returns an array of two numbers
*/
function parse(formula){
	formula = formula.trim().toLowerCase();

	if(formula === "even"){
		return [2, 0];
	} else if(formula === "odd"){
		return [2, 1];
	} else {
		var parsed = formula.match(re_nthElement);

		if(!parsed){
			throw new SyntaxError("n-th rule couldn't be parsed ('" + formula + "')");
		}

		var a;

		if(parsed[1]){
			a = parseInt(parsed[1], 10);
			if(!a){
				if(parsed[1].charAt(0) === "-") a = -1;
				else a = 1;
			}
		} else a = 0;

		return [
			a,
			parsed[3] ? parseInt((parsed[2] || "") + parsed[3], 10) : 0
		];
	}
}

/*
	returns a function that checks if an elements index matches the given rule
	highly optimized to return the fastest solution
*/
function compile(parsed){
	var a = parsed[0],
	    b = parsed[1] - 1;

	//when b <= 0, a*n won't be possible for any matches when a < 0
	//besides, the specification says that no element is matched when a and b are 0
	if(b < 0 && a <= 0) return falseFunc;

	//when a is in the range -1..1, it matches any element (so only b is checked)
	if(a ===-1) return function(pos){ return pos <= b; };
	if(a === 0) return function(pos){ return pos === b; };
	//when b <= 0 and a === 1, they match any element
	if(a === 1) return b < 0 ? trueFunc : function(pos){ return pos >= b; };

	//when a > 0, modulo can be used to check if there is a match
	var bMod = b % a;
	if(bMod < 0) bMod += a;

	if(a > 1){
		return function(pos){
			return pos >= b && pos % a === bMod;
		};
	}

	a *= -1; //make `a` positive

	return function(pos){
		return pos <= b && pos % a === bMod;
	};
}
},{"./basefunctions.js":12}],16:[function(require,module,exports){
/*
	pseudo selectors
	
	---
	
	they are available in two forms:
	* filters called when the selector 
	  is compiled and return a function
	  that needs to return next()
	* pseudos get called on execution
	  they need to return a boolean
*/

var DomUtils    = require("domutils"),
    isTag       = DomUtils.isTag,
    getText     = DomUtils.getText,
    getParent   = DomUtils.getParent,
    getChildren = DomUtils.getChildren,
    getSiblings = DomUtils.getSiblings,
    hasAttrib   = DomUtils.hasAttrib,
    getName     = DomUtils.getName,
    getAttribute= DomUtils.getAttributeValue,
    getNCheck   = require("./nth-check.js"),
    checkAttrib = require("./attributes.js").rules.equals,
    BaseFuncs   = require("./basefunctions.js"),
    trueFunc    = BaseFuncs.trueFunc,
    falseFunc   = BaseFuncs.falseFunc;

//helper methods
function getFirstElement(elems){
	for(var i = 0; elems && i < elems.length; i++){
		if(isTag(elems[i])) return elems[i];
	}
}

function getAttribFunc(name, value){
	var data = {name: name, value: value};
	return function attribFunc(next){
		return checkAttrib(next, data);
	};
}

function getChildFunc(next){
	return function(elem){
		return !!getParent(elem) && next(elem);
	};
}

var filters = {
	contains: function(next, text){
		if(
			(text.charAt(0) === "\"" || text.charAt(0) === "'") &&
			text.charAt(0) === text.substr(-1)
		){
			text = text.slice(1, -1);
		}
		return function contains(elem){
			return getText(elem).indexOf(text) >= 0 && next(elem);
		};
	},

	//location specific methods
	//first- and last-child methods return as soon as they find another element
	"first-child": function(next){
		return function firstChild(elem){
			return getFirstElement(getSiblings(elem)) === elem && next(elem);
		};
	},
	"last-child": function(next){
		return function lastChild(elem){
			var siblings = getSiblings(elem);

			for(var i = siblings.length - 1; i >= 0; i--){
				if(siblings[i] === elem) return next(elem);
				if(isTag(siblings[i])) break;
			}

			return false;
		};
	},
	"first-of-type": function(next){
		return function firstOfType(elem){
			var siblings = getSiblings(elem);

			for(var i = 0; i < siblings.length; i++){
				if(isTag(siblings[i])){
					if(siblings[i] === elem) return next(elem);
					if(getName(siblings[i]) === getName(elem)) break;
				}
			}

			return false;
		};
	},
	"last-of-type": function(next){
		return function lastOfType(elem){
			var siblings = getSiblings(elem);

			for(var i = siblings.length-1; i >= 0; i--){
				if(isTag(siblings[i])){
					if(siblings[i] === elem) return next(elem);
					if(getName(siblings[i]) === getName(elem)) break;
				}
			}

			return false;
		};
	},
	"only-of-type": function(next){
		return function onlyOfType(elem){
			var siblings = getSiblings(elem);

			for(var i = 0, j = siblings.length; i < j; i++){
				if(isTag(siblings[i])){
					if(siblings[i] === elem) continue;
					if(getName(siblings[i]) === getName(elem)) return false;
				}
			}

			return next(elem);
		};
	},
	"only-child": function(next){
		return function onlyChild(elem){
			var siblings = getSiblings(elem);

			for(var i = 0; i < siblings.length; i++){
				if(isTag(siblings[i]) && siblings[i] !== elem) return false;
			}

			return next(elem);
		};
	},
	"nth-child": function(next, rule){
		var func = getNCheck(rule);

		if(func === falseFunc) return func;
		if(func === trueFunc)  return getChildFunc(next);

		return function nthChild(elem){
			var siblings = getSiblings(elem);

			for(var i = 0, pos = 0; i < siblings.length; i++){
				if(isTag(siblings[i])){
					if(siblings[i] === elem) break;
					else pos++;
				}
			}

			return func(pos) && next(elem);
		};
	},
	"nth-last-child": function(next, rule){
		var func = getNCheck(rule);

		if(func === falseFunc) return func;
		if(func === trueFunc)  return getChildFunc(next);

		return function nthLastChild(elem){
			var siblings = getSiblings(elem);

			for(var pos = 0, i = siblings.length - 1; i >= 0; i--){
				if(isTag(siblings[i])){
					if(siblings[i] === elem) break;
					else pos++;
				}
			}

			return func(pos) && next(elem);
		};
	},
	"nth-of-type": function(next, rule){
		var func = getNCheck(rule);

		if(func === falseFunc) return func;
		if(func === trueFunc)  return getChildFunc(next);

		return function nthOfType(elem){
			var siblings = getSiblings(elem);

			for(var pos = 0, i = 0; i < siblings.length; i++){
				if(isTag(siblings[i])){
					if(siblings[i] === elem) break;
					if(getName(siblings[i]) === getName(elem)) pos++;
				}
			}

			return func(pos) && next(elem);
		};
	},
	"nth-last-of-type": function(next, rule){
		var func = getNCheck(rule);

		if(func === falseFunc) return func;
		if(func === trueFunc)  return getChildFunc(next);

		return function nthLastOfType(elem){
			var siblings = getSiblings(elem);

			for(var pos = 0, i = siblings.length - 1; i >= 0; i--){
				if(siblings[i] === elem) break;
				if(getName(siblings[i]) === getName(elem)) pos++;
			}

			return func(pos) && next(elem);
		};
	},

	//jQuery extensions (others follow as pseudos)
	checkbox: getAttribFunc("type", "checkbox"),
	file: getAttribFunc("type", "file"),
	password: getAttribFunc("type", "password"),
	radio: getAttribFunc("type", "radio"),
	reset: getAttribFunc("type", "reset"),
	image: getAttribFunc("type", "image"),
	submit: getAttribFunc("type", "submit")
};

//while filters are precompiled, pseudos get called when they are needed
var pseudos = {
	root: function(elem){
		return !getParent(elem);
	},
	empty: function(elem){
		return !getChildren(elem).some(function(elem){
			return isTag(elem) || elem.type === "text";
		});
	},

	//forms
	//to consider: :target, :enabled
	selected: function(elem){
		if(hasAttrib(elem, "selected")) return true;
		else if(getName(elem) !== "option") return false;

		//the first <option> in a <select> is also selected
		var parent = getParent(elem);

		if(!parent || getName(parent) !== "select") return false;

		var siblings = getChildren(parent),
			sawElem  = false;

		for(var i = 0; i < siblings.length; i++){
			if(isTag(siblings[i])){
				if(siblings[i] === elem){
					sawElem = true;
				} else if(!sawElem){
					return false;
				} else if(hasAttrib(siblings[i], "selected")){
					return false;
				}
			}
		}

		return sawElem;
	},
	disabled: function(elem){
		return hasAttrib(elem, "disabled");
	},
	enabled: function(elem){
		return !hasAttrib(elem, "disabled");
	},
	checked: function(elem){
		return hasAttrib(elem, "checked") || pseudos.selected(elem);
	},

	//jQuery extensions

	//:parent is the inverse of :empty
	parent: function(elem){
		return !pseudos.empty(elem);
	},
	header: function(elem){
		var name = getName(elem);
		return name === "h1" ||
		       name === "h2" ||
		       name === "h3" ||
		       name === "h4" ||
		       name === "h5" ||
		       name === "h6";
	},

	button: function(elem){
		var name = getName(elem);
		return name === "button" ||
		       name === "input" &&
		       getAttribute(elem, "type") === "button";
	},
	input: function(elem){
		var name = getName(elem);
		return name === "input" ||
		       name === "textarea" ||
		       name === "select" ||
		       name === "button";
	},
	text: function(elem){
		var attr;
		return getName(elem) === "input" && (
			!(attr = getAttribute(elem, "type")) ||
			attr.toLowerCase() === "text"
		);
	}
};

function verifyArgs(func, name, subselect){
	if(subselect === null){
		if(func.length > 1){
			throw new SyntaxError("pseudo-selector :" + name + " requires an argument");
		}
	} else {
		if(func.length === 1){
			throw new SyntaxError("pseudo-selector :" + name + " doesn't have any arguments");
		}	
	}
}

module.exports = {
	compile: function(next, data){
		var name = data.name,
			subselect = data.data;

		if(typeof filters[name] === "function"){
			verifyArgs(filters[name], name,  subselect);
			return filters[name](next, subselect);
		} else if(typeof pseudos[name] === "function"){
			var func = pseudos[name];
			verifyArgs(func, name, subselect);
			return function pseudoArgs(elem){
				return func(elem, subselect) && next(elem);
			};
		} else {
			throw new SyntaxError("unmatched pseudo-class :" + name);
		}
	},
	filters: filters,
	pseudos: pseudos
};

},{"./attributes.js":11,"./basefunctions.js":12,"./nth-check.js":15,"domutils":19}],17:[function(require,module,exports){
module.exports = sortByProcedure;

/*
	sort the parts of the passed selector,
	as there is potential for optimization
	(some types of selectors are faster than others)
*/

var procedure = {
	__proto__: null,
	universal: 5, //should be last so that it can be ignored
	tag: 3, //very quick test
	attribute: 1, //can be faster than class
	pseudo: 0, //can be pretty expensive (especially :has)

	//everything else shouldn't be moved
	descendant: -1,
	child: -1,
	sibling: -1,
	adjacent: -1
};

function sortByProcedure(arr){
	//TODO sort individual attribute selectors
	for(var i = 1; i < arr.length; i++){
		var procNew = procedure[arr[i].type];

		if(procNew !== -1){
			for(var j = i - 1; j >= 0 && procNew < procedure[arr[j].type]; j--){
				var tmp = arr[j + 1];
				arr[j + 1] = arr[j];
				arr[j] = tmp;
			}
		}
	}
	return arr;
}
},{}],18:[function(require,module,exports){
"use strict";

module.exports = parse;

var re_ws = /^\s/,
    re_name = /^(?:\\.|[\w\-\u00c0-\uFFFF])+/,
    re_cleanSelector = /([^\\])\s*([>~+,]|$)\s*/g,
    re_combinators = /^\s*[^\\]\s*[>~+,]|$\s*/g,
    re_escape = /\\([\da-f]{1,6}\s?|(\s)|.)/ig,
    re_comma = /^\s*,\s*/,
    //modified version of https://github.com/jquery/sizzle/blob/master/src/sizzle.js#L87
    re_attr = /^\s*((?:\\.|[\w\u00c0-\uFFFF\-])+)\s*(?:(\S?)=\s*(?:(['"])(.*?)\3|(#?(?:\\.|[\w\u00c0-\uFFFF\-])*)|)|)\s*(i)?\]/;

var actionTypes = {
	__proto__: null,
	"undefined": "exists",
	"":  "equals",
	"~": "element",
	"^": "start",
	"$": "end",
	"*": "any",
	"!": "not",
	"|": "hyphen"
};

var simpleSelectors = {
	__proto__: null,
	">": "child",
	"<": "parent",
	"~": "sibling",
	"+": "adjacent",
	"*": "universal"
};

var attribSelectors = {
	__proto__: null,
	"#": ["id", "equals"],
	".": ["class", "element"]
};

//unescape function taken from https://github.com/jquery/sizzle/blob/master/src/sizzle.js#L139
function funescape( _, escaped, escapedWhitespace ) {
	var high = "0x" + escaped - 0x10000;
	// NaN means non-codepoint
	// Support: Firefox
	// Workaround erroneous numeric interpretation of +"0x"
	return high !== high || escapedWhitespace ?
		escaped :
		// BMP codepoint
		high < 0 ?
			String.fromCharCode( high + 0x10000 ) :
			// Supplemental Plane codepoint (surrogate pair)
			String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
}

function unescapeCSS(str){
	return str.replace(re_escape, funescape);
}

function getClosingPos(selector){
	var pos = 1, counter = 1, len = selector.length;

	for(; counter > 0 && pos < len; pos++){
		if(selector.charAt(pos) === "(") counter++;
		else if(selector.charAt(pos) === ")") counter--;
	}

	return pos;
}

function parse(selector, options){
	selector = (selector + "").trimLeft().replace(re_cleanSelector, "$1$2");

	var subselects = [],
	    tokens = [],
	    data, firstChar, name;
	
	function getName(){
		var sub = selector.match(re_name)[0];
		selector = selector.substr(sub.length);
		return unescapeCSS(sub);
	}

	function getLCName(){
		var name = getName();

		if(!options || !options.xmlMode){
			name = name.toLowerCase();
		}

		return name;
	}

	while(selector !== ""){
		if(re_name.test(selector)){
			tokens.push({type: "tag", name: getLCName()});
		} else if(re_ws.test(selector)){
			tokens.push({type: "descendant"});
			selector = selector.trimLeft();
		} else {
			firstChar = selector.charAt(0);
			selector = selector.substr(1);

			if(firstChar in simpleSelectors){
				tokens.push({type: simpleSelectors[firstChar]});
			} else if(firstChar in attribSelectors){
				tokens.push({
					type: "attribute",
					name: attribSelectors[firstChar][0],
					action: attribSelectors[firstChar][1],
					value: getName(),
					ignoreCase: false
				});
			} else if(firstChar === "["){
				data = selector.match(re_attr);
				if(!data){
					throw new SyntaxError("Malformed attribute selector: " + selector);
				}
				selector = selector.substr(data[0].length);
				name = unescapeCSS(data[1]);

				if(!options || !options.xmlMode){
					name = name.toLowerCase();
				}

				tokens.push({
					type: "attribute",
					name: name,
					action: actionTypes[data[2]],
					value: unescapeCSS(data[4] || data[5] || ""),
					ignoreCase: !!data[6]
				});
				
			} else if(firstChar === ":"){
				//if(selector.charAt(0) === ":"){} //TODO pseudo-element
				name = getLCName();
				data = null;
				
				if(selector.charAt(0) === "("){
					var pos = getClosingPos(selector);
					data = selector.substr(1, pos - 2);
					selector = selector.substr(pos);
				}
				
				tokens.push({type: "pseudo", name: name, data: data});
			} else if(firstChar === ","){
				if(tokens.length === 0){
					throw new SyntaxError("empty sub-selector");
				}
				subselects.push(tokens);
				tokens = [];
			} else {
				//otherwise, the parser needs to throw or it would enter an infinite loop
				throw new SyntaxError("Unmatched selector: " + firstChar + selector);
			}
		}
	}
	
	if(subselects.length > 0 && tokens.length === 0){
		throw new SyntaxError("empty sub-selector");
	}
	subselects.push(tokens);
	return subselects;
}
},{}],19:[function(require,module,exports){
var DomUtils = module.exports;

var _domutilsmods = {};
_domutilsmods["stringify"] = require("./lib/stringify");
_domutilsmods["traversal"] = require("./lib/traversal");
_domutilsmods["manipulation"] = require("./lib/manipulation");
_domutilsmods["querying"] = require("./lib/querying");
_domutilsmods["legacy"] = require("./lib/legacy");
_domutilsmods["helpers"] = require("./lib/helpers");
[
	"stringify", "traversal", "manipulation", "querying", "legacy", "helpers"
].forEach(function(name){
	var ext = _domutilsmods[name];
	Object.keys(ext).forEach(function(key){
		DomUtils[key] = ext[key].bind(DomUtils);
	});
});

},{"./lib/helpers":20,"./lib/legacy":21,"./lib/manipulation":22,"./lib/querying":23,"./lib/stringify":24,"./lib/traversal":25}],20:[function(require,module,exports){
// removeSubsets
// Given an array of nodes, remove any member that is contained by another.
exports.removeSubsets = function(nodes) {
	var idx = nodes.length, node, ancestor, replace;

	// Check if each node (or one of its ancestors) is already contained in the
	// array.
	while (--idx > -1) {
		node = ancestor = nodes[idx];

		// Temporarily remove the node under consideration
		nodes[idx] = null;
		replace = true;

		while (ancestor) {
			if (nodes.indexOf(ancestor) > -1) {
				replace = false;
				nodes.splice(idx, 1);
				break;
			}
			ancestor = ancestor.parent;
		}

		// If the node has been found to be unique, re-insert it.
		if (replace) {
			nodes[idx] = node;
		}
	}

	return nodes;
};

},{}],21:[function(require,module,exports){
var ElementType = require("domelementtype");
var isTag = exports.isTag = ElementType.isTag;

exports.testElement = function(options, element){
	for(var key in options){
		if(!options.hasOwnProperty(key));
		else if(key === "tag_name"){
			if(!isTag(element) || !options.tag_name(element.name)){
				return false;
			}
		} else if(key === "tag_type"){
			if(!options.tag_type(element.type)) return false;
		} else if(key === "tag_contains"){
			if(isTag(element) || !options.tag_contains(element.data)){
				return false;
			}
		} else if(!element.attribs || !options[key](element.attribs[key])){
			return false;
		}
	}
	return true;
};

var Checks = {
	tag_name: function(name){
		if(typeof name === "function"){
			return function(elem){ return isTag(elem) && name(elem.name); };
		} else if(name === "*"){
			return isTag;
		} else {
			return function(elem){ return isTag(elem) && elem.name === name; };
		}
	},
	tag_type: function(type){
		if(typeof type === "function"){
			return function(elem){ return type(elem.type); };
		} else {
			return function(elem){ return elem.type === type; };
		}
	},
	tag_contains: function(data){
		if(typeof data === "function"){
			return function(elem){ return !isTag(elem) && data(elem.data); };
		} else {
			return function(elem){ return !isTag(elem) && elem.data === data; };
		}
	}
};

function getAttribCheck(attrib, value){
	if(typeof value === "function"){
		return function(elem){ return elem.attribs && value(elem.attribs[attrib]); };
	} else {
		return function(elem){ return elem.attribs && elem.attribs[attrib] === value; };
	}
}

function combineFuncs(a, b){
	return function(elem){
		return a(elem) || b(elem);
	};
}

exports.getElements = function(options, element, recurse, limit){
	var funcs = Object.keys(options).map(function(key){
		var value = options[key];
		return key in Checks ? Checks[key](value) : getAttribCheck(key, value);
	});

	return funcs.length === 0 ? [] : this.filter(
		funcs.reduce(combineFuncs),
		element, recurse, limit
	);
};

exports.getElementById = function(id, element, recurse){
	if(!Array.isArray(element)) element = [element];
	return this.findOne(getAttribCheck("id", id), element, recurse !== false);
};

exports.getElementsByTagName = function(name, element, recurse, limit){
	return this.filter(Checks.tag_name(name), element, recurse, limit);
};

exports.getElementsByTagType = function(type, element, recurse, limit){
	return this.filter(Checks.tag_type(type), element, recurse, limit);
};

},{"domelementtype":26}],22:[function(require,module,exports){
exports.removeElement = function(elem){
	if(elem.prev) elem.prev.next = elem.next;
	if(elem.next) elem.next.prev = elem.prev;

	if(elem.parent){
		var childs = elem.parent.children;
		childs.splice(childs.lastIndexOf(elem), 1);
	}
};

exports.replaceElement = function(elem, replacement){
	var prev = replacement.prev = elem.prev;
	if(prev){
		prev.next = replacement;
	}

	var next = replacement.next = elem.next;
	if(next){
		next.prev = replacement;
	}

	var parent = replacement.parent = elem.parent;
	if(parent){
		var childs = parent.children;
		childs[childs.lastIndexOf(elem)] = replacement;
	}
};

exports.appendChild = function(elem, child){
	child.parent = elem;

	if(elem.children.push(child) !== 1){
		var sibling = elem.children[elem.children.length - 2];
		sibling.next = child;
		child.prev = sibling;
		child.next = null;
	}
};

exports.append = function(elem, next){
	var parent = elem.parent,
		currNext = elem.next;

	next.next = currNext;
	next.prev = elem;
	elem.next = next;

	if(currNext){
		currNext.prev = next;
		if(parent){
			var childs = parent.children;
			childs.splice(childs.lastIndexOf(currNext), 0, next);
		}
	} else if(parent){
		parent.children.push(next);
	}
};

exports.prepend = function(elem, prev){
	var parent = elem.parent;
	if(parent){
		var childs = parent.children;
		childs.splice(childs.lastIndexOf(elem), 0, prev);
	}

	if(elem.prev){
		elem.prev.next = prev;
	}
	prev.prev = elem.prev;
	prev.next = elem;
	elem.prev = prev;
};



},{}],23:[function(require,module,exports){
exports.find = function(test, arr, recurse, limit){
	var result = [], childs;

	for(var i = 0, j = arr.length; i < j; i++){
		if(test(arr[i])){
			result.push(arr[i]);
			if(--limit <= 0) break;
		}

		childs = this.getChildren(arr[i]);
		if(recurse && childs && childs.length > 0){
			childs = this.find(test, childs, recurse, limit);
			result = result.concat(childs);
			limit -= childs.length;
			if(limit <= 0) break;
		}
	}

	return result;
};

exports.findOneChild = function(test, arr){
	for(var i = 0, l = arr.length; i < l; i++){
		if(test(arr[i])) return arr[i];
	}

	return null;
};

exports.findOne = function(test, arr){
	var elem = null;

	for(var i = 0, l = arr.length; i < l && !elem; i++){
		if(test(arr[i])){
			elem = arr[i];
		} else if(arr[i].children && arr[i].children.length > 0){
			elem = this.findOne(test, arr[i].children);
		}
	}

	return elem;
};

exports.findAll = function(test, elems){
	var result = [];
	for(var i = 0, j = elems.length; i < j; i++){
		if(test(elems[i])) result.push(elems[i]);

		var childs = this.getChildren(elems[i]);
		if(childs && childs.length){
			result = result.concat(this.findAll(test, childs));
		}
	}
	return result;
};

exports.filter = function(test, element, recurse, limit){
	if(!Array.isArray(element)) element = [element];

	if(typeof limit !== "number" || !isFinite(limit)){
		if(recurse === false){
			return element.filter(test);
		} else {
			return this.findAll(test, element);
		}
	} else if(limit === 1){
		if(recurse === false){
			element = this.findOneChild(test, element);
		} else {
			element = this.findOne(test, element);
		}
		return element ? [element] : [];
	} else {
		return this.find(test, element, recurse !== false, limit);
	}
};

},{}],24:[function(require,module,exports){
var ElementType = require("domelementtype"),
    isTag = ElementType.isTag;

module.exports = {
	getInnerHTML: getInnerHTML,
	getOuterHTML: getOuterHTML,
	getText: getText
};

function getInnerHTML(elem){
	return elem.children ? elem.children.map(getOuterHTML).join("") : "";
}

//boolean attributes without a value (taken from MatthewMueller/cheerio)
var booleanAttribs = {
	__proto__: null,
	async: true,
	autofocus: true,
	autoplay: true,
	checked: true,
	controls: true,
	defer: true,
	disabled: true,
	hidden: true,
	loop: true,
	multiple: true,
	open: true,
	readonly: true,
	required: true,
	scoped: true,
	selected: true
};

var emptyTags = {
	__proto__: null,
	area: true,
	base: true,
	basefont: true,
	br: true,
	col: true,
	frame: true,
	hr: true,
	img: true,
	input: true,
	isindex: true,
	link: true,
	meta: true,
	param: true,
	embed: true
};

function getOuterHTML(elem){
	switch(elem.type){
	case ElementType.Text:
		return elem.data;
	case ElementType.Comment:
		return "<!--" + elem.data + "-->";
	case ElementType.Directive:
		return "<" + elem.data + ">";
	case ElementType.CDATA:
		return "<!CDATA " + getInnerHTML(elem) + "]]>";
	}

	var ret = "<" + elem.name;
	if("attribs" in elem){
		for(var attr in elem.attribs){
			if(elem.attribs.hasOwnProperty(attr)){
				ret += " " + attr;
				var value = elem.attribs[attr];
				if(value == null){
					if( !(attr in booleanAttribs) ){
						ret += "=\"\"";
					}
				} else {
					ret += "=\"" + value + "\"";
				}
			}
		}
	}

	if (elem.name in emptyTags && elem.children.length === 0) {
		return ret + " />";
	} else {
		return ret + ">" + getInnerHTML(elem) + "</" + elem.name + ">";
	}
}

function getText(elem){
	if(Array.isArray(elem)) return elem.map(getText).join("");
	if(isTag(elem) || elem.type === ElementType.CDATA) return getText(elem.children);
	if(elem.type === ElementType.Text) return elem.data;
	return "";
}
},{"domelementtype":26}],25:[function(require,module,exports){
var getChildren = exports.getChildren = function(elem){
	return elem.children;
};

var getParent = exports.getParent = function(elem){
	return elem.parent;
};

exports.getSiblings = function(elem){
	var parent = getParent(elem);
	return parent ? getChildren(parent) : [elem];
};

exports.getAttributeValue = function(elem, name){
	return elem.attribs && elem.attribs[name];
};

exports.hasAttrib = function(elem, name){
	return hasOwnProperty.call(elem.attribs, name);
};

exports.getName = function(elem){
	return elem.name;
};

},{}],26:[function(require,module,exports){
//Types of elements found in the DOM
module.exports = {
	Text: "text", //Text
	Directive: "directive", //<? ... ?>
	Comment: "comment", //<!-- ... -->
	Script: "script", //<script> tags
	Style: "style", //<style> tags
	Tag: "tag", //Any tag
	CDATA: "cdata", //<![CDATA[ ... ]]>

	isTag: function(elem){
		return elem.type === "tag" || elem.type === "script" || elem.type === "style";
	}
};
},{}],27:[function(require,module,exports){
module.exports={"Aacute;":"\u00C1","Aacute":"\u00C1","aacute;":"\u00E1","aacute":"\u00E1","Acirc;":"\u00C2","Acirc":"\u00C2","acirc;":"\u00E2","acirc":"\u00E2","acute;":"\u00B4","acute":"\u00B4","AElig;":"\u00C6","AElig":"\u00C6","aelig;":"\u00E6","aelig":"\u00E6","Agrave;":"\u00C0","Agrave":"\u00C0","agrave;":"\u00E0","agrave":"\u00E0","alefsym;":"\u2135","Alpha;":"\u0391","alpha;":"\u03B1","amp":"\u0026","and;":"\u2227","ang;":"\u2220","apos":"\u0027","Aring;":"\u00C5","Aring":"\u00C5","aring;":"\u00E5","aring":"\u00E5","asymp;":"\u2248","Atilde;":"\u00C3","Atilde":"\u00C3","atilde;":"\u00E3","atilde":"\u00E3","Auml;":"\u00C4","Auml":"\u00C4","auml;":"\u00E4","auml":"\u00E4","bdquo;":"\u201E","Beta;":"\u0392","beta;":"\u03B2","brvbar;":"\u00A6","brvbar":"\u00A6","bull;":"\u2022","cap;":"\u2229","Ccedil;":"\u00C7","Ccedil":"\u00C7","ccedil;":"\u00E7","ccedil":"\u00E7","cedil;":"\u00B8","cedil":"\u00B8","cent;":"\u00A2","cent":"\u00A2","Chi;":"\u03A7","chi;":"\u03C7","circ;":"\u02C6","clubs;":"\u2663","cong;":"\u2245","copy;":"\u00A9","copy":"\u00A9","crarr;":"\u21B5","cup;":"\u222A","curren;":"\u00A4","curren":"\u00A4","dagger;":"\u2020","Dagger;":"\u2021","darr;":"\u2193","dArr;":"\u21D3","deg;":"\u00B0","deg":"\u00B0","Delta;":"\u0394","delta;":"\u03B4","diams;":"\u2666","divide;":"\u00F7","divide":"\u00F7","Eacute;":"\u00C9","Eacute":"\u00C9","eacute;":"\u00E9","eacute":"\u00E9","Ecirc;":"\u00CA","Ecirc":"\u00CA","ecirc;":"\u00EA","ecirc":"\u00EA","Egrave;":"\u00C8","Egrave":"\u00C8","egrave;":"\u00E8","egrave":"\u00E8","empty;":"\u2205","emsp;":"\u2003","ensp;":"\u2002","Epsilon;":"\u0395","epsilon;":"\u03B5","equiv;":"\u2261","Eta;":"\u0397","eta;":"\u03B7","ETH;":"\u00D0","ETH":"\u00D0","eth;":"\u00F0","eth":"\u00F0","Euml;":"\u00CB","Euml":"\u00CB","euml;":"\u00EB","euml":"\u00EB","euro;":"\u20AC","exist;":"\u2203","fnof;":"\u0192","forall;":"\u2200","frac12;":"\u00BD","frac12":"\u00BD","frac14;":"\u00BC","frac14":"\u00BC","frac34;":"\u00BE","frac34":"\u00BE","frasl;":"\u2044","Gamma;":"\u0393","gamma;":"\u03B3","ge;":"\u2265","gt":"\u003E","harr;":"\u2194","hArr;":"\u21D4","hearts;":"\u2665","hellip;":"\u2026","Iacute;":"\u00CD","Iacute":"\u00CD","iacute;":"\u00ED","iacute":"\u00ED","Icirc;":"\u00CE","Icirc":"\u00CE","icirc;":"\u00EE","icirc":"\u00EE","iexcl;":"\u00A1","iexcl":"\u00A1","Igrave;":"\u00CC","Igrave":"\u00CC","igrave;":"\u00EC","igrave":"\u00EC","image;":"\u2111","infin;":"\u221E","int;":"\u222B","Iota;":"\u0399","iota;":"\u03B9","iquest;":"\u00BF","iquest":"\u00BF","isin;":"\u2208","Iuml;":"\u00CF","Iuml":"\u00CF","iuml;":"\u00EF","iuml":"\u00EF","Kappa;":"\u039A","kappa;":"\u03BA","Lambda;":"\u039B","lambda;":"\u03BB","lang;":"\u27E8","laquo;":"\u00AB","laquo":"\u00AB","larr;":"\u2190","lArr;":"\u21D0","lceil;":"\u2308","ldquo;":"\u201C","le;":"\u2264","lfloor;":"\u230A","lowast;":"\u2217","loz;":"\u25CA","lrm;":"\u200E","lsaquo;":"\u2039","lsquo;":"\u2018","lt":"\u003C","macr;":"\u00AF","macr":"\u00AF","mdash;":"\u2014","micro;":"\u00B5","micro":"\u00B5","middot;":"\u00B7","middot":"\u00B7","minus;":"\u2212","Mu;":"\u039C","mu;":"\u03BC","nabla;":"\u2207","nbsp;":"\u00A0","nbsp":"\u00A0","ndash;":"\u2013","ne;":"\u2260","ni;":"\u220B","not;":"\u00AC","not":"\u00AC","notin;":"\u2209","nsub;":"\u2284","Ntilde;":"\u00D1","Ntilde":"\u00D1","ntilde;":"\u00F1","ntilde":"\u00F1","Nu;":"\u039D","nu;":"\u03BD","Oacute;":"\u00D3","Oacute":"\u00D3","oacute;":"\u00F3","oacute":"\u00F3","Ocirc;":"\u00D4","Ocirc":"\u00D4","ocirc;":"\u00F4","ocirc":"\u00F4","OElig;":"\u0152","oelig;":"\u0153","Ograve;":"\u00D2","Ograve":"\u00D2","ograve;":"\u00F2","ograve":"\u00F2","oline;":"\u203E","Omega;":"\u03A9","omega;":"\u03C9","Omicron;":"\u039F","omicron;":"\u03BF","oplus;":"\u2295","or;":"\u2228","ordf;":"\u00AA","ordf":"\u00AA","ordm;":"\u00BA","ordm":"\u00BA","Oslash;":"\u00D8","Oslash":"\u00D8","oslash;":"\u00F8","oslash":"\u00F8","Otilde;":"\u00D5","Otilde":"\u00D5","otilde;":"\u00F5","otilde":"\u00F5","otimes;":"\u2297","Ouml;":"\u00D6","Ouml":"\u00D6","ouml;":"\u00F6","ouml":"\u00F6","para;":"\u00B6","para":"\u00B6","part;":"\u2202","permil;":"\u2030","perp;":"\u22A5","Phi;":"\u03A6","phi;":"\u03C6","Pi;":"\u03A0","pi;":"\u03C0","piv;":"\u03D6","plusmn;":"\u00B1","plusmn":"\u00B1","pound;":"\u00A3","pound":"\u00A3","prime;":"\u2032","Prime;":"\u2033","prod;":"\u220F","prop;":"\u221D","Psi;":"\u03A8","psi;":"\u03C8","quot":"\u0022","radic;":"\u221A","rang;":"\u27E9","raquo;":"\u00BB","raquo":"\u00BB","rarr;":"\u2192","rArr;":"\u21D2","rceil;":"\u2309","rdquo;":"\u201D","real;":"\u211C","reg;":"\u00AE","reg":"\u00AE","rfloor;":"\u230B","Rho;":"\u03A1","rho;":"\u03C1","rlm;":"\u200F","rsaquo;":"\u203A","rsquo;":"\u2019","sbquo;":"\u201A","Scaron;":"\u0160","scaron;":"\u0161","sdot;":"\u22C5","sect;":"\u00A7","sect":"\u00A7","shy;":"\u00AD","shy":"\u00AD","Sigma;":"\u03A3","sigma;":"\u03C3","sigmaf;":"\u03C2","sim;":"\u223C","spades;":"\u2660","sub;":"\u2282","sube;":"\u2286","sum;":"\u2211","sup1;":"\u00B9","sup1":"\u00B9","sup2;":"\u00B2","sup2":"\u00B2","sup3;":"\u00B3","sup3":"\u00B3","sup;":"\u2283","supe;":"\u2287","szlig;":"\u00DF","szlig":"\u00DF","Tau;":"\u03A4","tau;":"\u03C4","there4;":"\u2234","Theta;":"\u0398","theta;":"\u03B8","thetasym;":"\u03D1","thinsp;":"\u2009","THORN;":"\u00DE","THORN":"\u00DE","thorn;":"\u00FE","thorn":"\u00FE","tilde;":"\u02DC","times;":"\u00D7","times":"\u00D7","trade;":"\u2122","Uacute;":"\u00DA","Uacute":"\u00DA","uacute;":"\u00FA","uacute":"\u00FA","uarr;":"\u2191","uArr;":"\u21D1","Ucirc;":"\u00DB","Ucirc":"\u00DB","ucirc;":"\u00FB","ucirc":"\u00FB","Ugrave;":"\u00D9","Ugrave":"\u00D9","ugrave;":"\u00F9","ugrave":"\u00F9","uml;":"\u00A8","uml":"\u00A8","upsih;":"\u03D2","Upsilon;":"\u03A5","upsilon;":"\u03C5","Uuml;":"\u00DC","Uuml":"\u00DC","uuml;":"\u00FC","uuml":"\u00FC","weierp;":"\u2118","Xi;":"\u039E","xi;":"\u03BE","Yacute;":"\u00DD","Yacute":"\u00DD","yacute;":"\u00FD","yacute":"\u00FD","yen;":"\u00A5","yen":"\u00A5","yuml;":"\u00FF","yuml":"\u00FF","Yuml;":"\u0178","Zeta;":"\u0396","zeta;":"\u03B6","zwj;":"\u200D","zwnj;":"\u200C"}
},{}],28:[function(require,module,exports){
module.exports={"Abreve;":"\u0102","abreve;":"\u0103","ac;":"\u223E","acd;":"\u223F","acE;":"\u223E\u0333","Acy;":"\u0410","acy;":"\u0430","af;":"\u2061","Afr;":"\uD835\uDD04","afr;":"\uD835\uDD1E","aleph;":"\u2135","Amacr;":"\u0100","amacr;":"\u0101","amalg;":"\u2A3F","AMP;":"\u0026","AMP":"\u0026","andand;":"\u2A55","And;":"\u2A53","andd;":"\u2A5C","andslope;":"\u2A58","andv;":"\u2A5A","ange;":"\u29A4","angle;":"\u2220","angmsdaa;":"\u29A8","angmsdab;":"\u29A9","angmsdac;":"\u29AA","angmsdad;":"\u29AB","angmsdae;":"\u29AC","angmsdaf;":"\u29AD","angmsdag;":"\u29AE","angmsdah;":"\u29AF","angmsd;":"\u2221","angrt;":"\u221F","angrtvb;":"\u22BE","angrtvbd;":"\u299D","angsph;":"\u2222","angst;":"\u00C5","angzarr;":"\u237C","Aogon;":"\u0104","aogon;":"\u0105","Aopf;":"\uD835\uDD38","aopf;":"\uD835\uDD52","apacir;":"\u2A6F","ap;":"\u2248","apE;":"\u2A70","ape;":"\u224A","apid;":"\u224B","ApplyFunction;":"\u2061","approx;":"\u2248","approxeq;":"\u224A","Ascr;":"\uD835\uDC9C","ascr;":"\uD835\uDCB6","Assign;":"\u2254","ast;":"\u002A","asympeq;":"\u224D","awconint;":"\u2233","awint;":"\u2A11","backcong;":"\u224C","backepsilon;":"\u03F6","backprime;":"\u2035","backsim;":"\u223D","backsimeq;":"\u22CD","Backslash;":"\u2216","Barv;":"\u2AE7","barvee;":"\u22BD","barwed;":"\u2305","Barwed;":"\u2306","barwedge;":"\u2305","bbrk;":"\u23B5","bbrktbrk;":"\u23B6","bcong;":"\u224C","Bcy;":"\u0411","bcy;":"\u0431","becaus;":"\u2235","because;":"\u2235","Because;":"\u2235","bemptyv;":"\u29B0","bepsi;":"\u03F6","bernou;":"\u212C","Bernoullis;":"\u212C","beth;":"\u2136","between;":"\u226C","Bfr;":"\uD835\uDD05","bfr;":"\uD835\uDD1F","bigcap;":"\u22C2","bigcirc;":"\u25EF","bigcup;":"\u22C3","bigodot;":"\u2A00","bigoplus;":"\u2A01","bigotimes;":"\u2A02","bigsqcup;":"\u2A06","bigstar;":"\u2605","bigtriangledown;":"\u25BD","bigtriangleup;":"\u25B3","biguplus;":"\u2A04","bigvee;":"\u22C1","bigwedge;":"\u22C0","bkarow;":"\u290D","blacklozenge;":"\u29EB","blacksquare;":"\u25AA","blacktriangle;":"\u25B4","blacktriangledown;":"\u25BE","blacktriangleleft;":"\u25C2","blacktriangleright;":"\u25B8","blank;":"\u2423","blk12;":"\u2592","blk14;":"\u2591","blk34;":"\u2593","block;":"\u2588","bne;":"\u003D\u20E5","bnequiv;":"\u2261\u20E5","bNot;":"\u2AED","bnot;":"\u2310","Bopf;":"\uD835\uDD39","bopf;":"\uD835\uDD53","bot;":"\u22A5","bottom;":"\u22A5","bowtie;":"\u22C8","boxbox;":"\u29C9","boxdl;":"\u2510","boxdL;":"\u2555","boxDl;":"\u2556","boxDL;":"\u2557","boxdr;":"\u250C","boxdR;":"\u2552","boxDr;":"\u2553","boxDR;":"\u2554","boxh;":"\u2500","boxH;":"\u2550","boxhd;":"\u252C","boxHd;":"\u2564","boxhD;":"\u2565","boxHD;":"\u2566","boxhu;":"\u2534","boxHu;":"\u2567","boxhU;":"\u2568","boxHU;":"\u2569","boxminus;":"\u229F","boxplus;":"\u229E","boxtimes;":"\u22A0","boxul;":"\u2518","boxuL;":"\u255B","boxUl;":"\u255C","boxUL;":"\u255D","boxur;":"\u2514","boxuR;":"\u2558","boxUr;":"\u2559","boxUR;":"\u255A","boxv;":"\u2502","boxV;":"\u2551","boxvh;":"\u253C","boxvH;":"\u256A","boxVh;":"\u256B","boxVH;":"\u256C","boxvl;":"\u2524","boxvL;":"\u2561","boxVl;":"\u2562","boxVL;":"\u2563","boxvr;":"\u251C","boxvR;":"\u255E","boxVr;":"\u255F","boxVR;":"\u2560","bprime;":"\u2035","breve;":"\u02D8","Breve;":"\u02D8","bscr;":"\uD835\uDCB7","Bscr;":"\u212C","bsemi;":"\u204F","bsim;":"\u223D","bsime;":"\u22CD","bsolb;":"\u29C5","bsol;":"\u005C","bsolhsub;":"\u27C8","bullet;":"\u2022","bump;":"\u224E","bumpE;":"\u2AAE","bumpe;":"\u224F","Bumpeq;":"\u224E","bumpeq;":"\u224F","Cacute;":"\u0106","cacute;":"\u0107","capand;":"\u2A44","capbrcup;":"\u2A49","capcap;":"\u2A4B","Cap;":"\u22D2","capcup;":"\u2A47","capdot;":"\u2A40","CapitalDifferentialD;":"\u2145","caps;":"\u2229\uFE00","caret;":"\u2041","caron;":"\u02C7","Cayleys;":"\u212D","ccaps;":"\u2A4D","Ccaron;":"\u010C","ccaron;":"\u010D","Ccirc;":"\u0108","ccirc;":"\u0109","Cconint;":"\u2230","ccups;":"\u2A4C","ccupssm;":"\u2A50","Cdot;":"\u010A","cdot;":"\u010B","Cedilla;":"\u00B8","cemptyv;":"\u29B2","centerdot;":"\u00B7","CenterDot;":"\u00B7","cfr;":"\uD835\uDD20","Cfr;":"\u212D","CHcy;":"\u0427","chcy;":"\u0447","check;":"\u2713","checkmark;":"\u2713","circeq;":"\u2257","circlearrowleft;":"\u21BA","circlearrowright;":"\u21BB","circledast;":"\u229B","circledcirc;":"\u229A","circleddash;":"\u229D","CircleDot;":"\u2299","circledR;":"\u00AE","circledS;":"\u24C8","CircleMinus;":"\u2296","CirclePlus;":"\u2295","CircleTimes;":"\u2297","cir;":"\u25CB","cirE;":"\u29C3","cire;":"\u2257","cirfnint;":"\u2A10","cirmid;":"\u2AEF","cirscir;":"\u29C2","ClockwiseContourIntegral;":"\u2232","CloseCurlyDoubleQuote;":"\u201D","CloseCurlyQuote;":"\u2019","clubsuit;":"\u2663","colon;":"\u003A","Colon;":"\u2237","Colone;":"\u2A74","colone;":"\u2254","coloneq;":"\u2254","comma;":"\u002C","commat;":"\u0040","comp;":"\u2201","compfn;":"\u2218","complement;":"\u2201","complexes;":"\u2102","congdot;":"\u2A6D","Congruent;":"\u2261","conint;":"\u222E","Conint;":"\u222F","ContourIntegral;":"\u222E","copf;":"\uD835\uDD54","Copf;":"\u2102","coprod;":"\u2210","Coproduct;":"\u2210","COPY;":"\u00A9","COPY":"\u00A9","copysr;":"\u2117","CounterClockwiseContourIntegral;":"\u2233","cross;":"\u2717","Cross;":"\u2A2F","Cscr;":"\uD835\uDC9E","cscr;":"\uD835\uDCB8","csub;":"\u2ACF","csube;":"\u2AD1","csup;":"\u2AD0","csupe;":"\u2AD2","ctdot;":"\u22EF","cudarrl;":"\u2938","cudarrr;":"\u2935","cuepr;":"\u22DE","cuesc;":"\u22DF","cularr;":"\u21B6","cularrp;":"\u293D","cupbrcap;":"\u2A48","cupcap;":"\u2A46","CupCap;":"\u224D","Cup;":"\u22D3","cupcup;":"\u2A4A","cupdot;":"\u228D","cupor;":"\u2A45","cups;":"\u222A\uFE00","curarr;":"\u21B7","curarrm;":"\u293C","curlyeqprec;":"\u22DE","curlyeqsucc;":"\u22DF","curlyvee;":"\u22CE","curlywedge;":"\u22CF","curvearrowleft;":"\u21B6","curvearrowright;":"\u21B7","cuvee;":"\u22CE","cuwed;":"\u22CF","cwconint;":"\u2232","cwint;":"\u2231","cylcty;":"\u232D","daleth;":"\u2138","Darr;":"\u21A1","dash;":"\u2010","Dashv;":"\u2AE4","dashv;":"\u22A3","dbkarow;":"\u290F","dblac;":"\u02DD","Dcaron;":"\u010E","dcaron;":"\u010F","Dcy;":"\u0414","dcy;":"\u0434","ddagger;":"\u2021","ddarr;":"\u21CA","DD;":"\u2145","dd;":"\u2146","DDotrahd;":"\u2911","ddotseq;":"\u2A77","Del;":"\u2207","demptyv;":"\u29B1","dfisht;":"\u297F","Dfr;":"\uD835\uDD07","dfr;":"\uD835\uDD21","dHar;":"\u2965","dharl;":"\u21C3","dharr;":"\u21C2","DiacriticalAcute;":"\u00B4","DiacriticalDot;":"\u02D9","DiacriticalDoubleAcute;":"\u02DD","DiacriticalGrave;":"\u0060","DiacriticalTilde;":"\u02DC","diam;":"\u22C4","diamond;":"\u22C4","Diamond;":"\u22C4","diamondsuit;":"\u2666","die;":"\u00A8","DifferentialD;":"\u2146","digamma;":"\u03DD","disin;":"\u22F2","div;":"\u00F7","divideontimes;":"\u22C7","divonx;":"\u22C7","DJcy;":"\u0402","djcy;":"\u0452","dlcorn;":"\u231E","dlcrop;":"\u230D","dollar;":"\u0024","Dopf;":"\uD835\uDD3B","dopf;":"\uD835\uDD55","Dot;":"\u00A8","dot;":"\u02D9","DotDot;":"\u20DC","doteq;":"\u2250","doteqdot;":"\u2251","DotEqual;":"\u2250","dotminus;":"\u2238","dotplus;":"\u2214","dotsquare;":"\u22A1","doublebarwedge;":"\u2306","DoubleContourIntegral;":"\u222F","DoubleDot;":"\u00A8","DoubleDownArrow;":"\u21D3","DoubleLeftArrow;":"\u21D0","DoubleLeftRightArrow;":"\u21D4","DoubleLeftTee;":"\u2AE4","DoubleLongLeftArrow;":"\u27F8","DoubleLongLeftRightArrow;":"\u27FA","DoubleLongRightArrow;":"\u27F9","DoubleRightArrow;":"\u21D2","DoubleRightTee;":"\u22A8","DoubleUpArrow;":"\u21D1","DoubleUpDownArrow;":"\u21D5","DoubleVerticalBar;":"\u2225","DownArrowBar;":"\u2913","downarrow;":"\u2193","DownArrow;":"\u2193","Downarrow;":"\u21D3","DownArrowUpArrow;":"\u21F5","DownBreve;":"\u0311","downdownarrows;":"\u21CA","downharpoonleft;":"\u21C3","downharpoonright;":"\u21C2","DownLeftRightVector;":"\u2950","DownLeftTeeVector;":"\u295E","DownLeftVectorBar;":"\u2956","DownLeftVector;":"\u21BD","DownRightTeeVector;":"\u295F","DownRightVectorBar;":"\u2957","DownRightVector;":"\u21C1","DownTeeArrow;":"\u21A7","DownTee;":"\u22A4","drbkarow;":"\u2910","drcorn;":"\u231F","drcrop;":"\u230C","Dscr;":"\uD835\uDC9F","dscr;":"\uD835\uDCB9","DScy;":"\u0405","dscy;":"\u0455","dsol;":"\u29F6","Dstrok;":"\u0110","dstrok;":"\u0111","dtdot;":"\u22F1","dtri;":"\u25BF","dtrif;":"\u25BE","duarr;":"\u21F5","duhar;":"\u296F","dwangle;":"\u29A6","DZcy;":"\u040F","dzcy;":"\u045F","dzigrarr;":"\u27FF","easter;":"\u2A6E","Ecaron;":"\u011A","ecaron;":"\u011B","ecir;":"\u2256","ecolon;":"\u2255","Ecy;":"\u042D","ecy;":"\u044D","eDDot;":"\u2A77","Edot;":"\u0116","edot;":"\u0117","eDot;":"\u2251","ee;":"\u2147","efDot;":"\u2252","Efr;":"\uD835\uDD08","efr;":"\uD835\uDD22","eg;":"\u2A9A","egs;":"\u2A96","egsdot;":"\u2A98","el;":"\u2A99","Element;":"\u2208","elinters;":"\u23E7","ell;":"\u2113","els;":"\u2A95","elsdot;":"\u2A97","Emacr;":"\u0112","emacr;":"\u0113","emptyset;":"\u2205","EmptySmallSquare;":"\u25FB","emptyv;":"\u2205","EmptyVerySmallSquare;":"\u25AB","emsp13;":"\u2004","emsp14;":"\u2005","ENG;":"\u014A","eng;":"\u014B","Eogon;":"\u0118","eogon;":"\u0119","Eopf;":"\uD835\uDD3C","eopf;":"\uD835\uDD56","epar;":"\u22D5","eparsl;":"\u29E3","eplus;":"\u2A71","epsi;":"\u03B5","epsiv;":"\u03F5","eqcirc;":"\u2256","eqcolon;":"\u2255","eqsim;":"\u2242","eqslantgtr;":"\u2A96","eqslantless;":"\u2A95","Equal;":"\u2A75","equals;":"\u003D","EqualTilde;":"\u2242","equest;":"\u225F","Equilibrium;":"\u21CC","equivDD;":"\u2A78","eqvparsl;":"\u29E5","erarr;":"\u2971","erDot;":"\u2253","escr;":"\u212F","Escr;":"\u2130","esdot;":"\u2250","Esim;":"\u2A73","esim;":"\u2242","excl;":"\u0021","Exists;":"\u2203","expectation;":"\u2130","exponentiale;":"\u2147","ExponentialE;":"\u2147","fallingdotseq;":"\u2252","Fcy;":"\u0424","fcy;":"\u0444","female;":"\u2640","ffilig;":"\uFB03","fflig;":"\uFB00","ffllig;":"\uFB04","Ffr;":"\uD835\uDD09","ffr;":"\uD835\uDD23","filig;":"\uFB01","FilledSmallSquare;":"\u25FC","FilledVerySmallSquare;":"\u25AA","fjlig;":"\u0066\u006A","flat;":"\u266D","fllig;":"\uFB02","fltns;":"\u25B1","Fopf;":"\uD835\uDD3D","fopf;":"\uD835\uDD57","ForAll;":"\u2200","fork;":"\u22D4","forkv;":"\u2AD9","Fouriertrf;":"\u2131","fpartint;":"\u2A0D","frac13;":"\u2153","frac15;":"\u2155","frac16;":"\u2159","frac18;":"\u215B","frac23;":"\u2154","frac25;":"\u2156","frac35;":"\u2157","frac38;":"\u215C","frac45;":"\u2158","frac56;":"\u215A","frac58;":"\u215D","frac78;":"\u215E","frown;":"\u2322","fscr;":"\uD835\uDCBB","Fscr;":"\u2131","gacute;":"\u01F5","Gammad;":"\u03DC","gammad;":"\u03DD","gap;":"\u2A86","Gbreve;":"\u011E","gbreve;":"\u011F","Gcedil;":"\u0122","Gcirc;":"\u011C","gcirc;":"\u011D","Gcy;":"\u0413","gcy;":"\u0433","Gdot;":"\u0120","gdot;":"\u0121","gE;":"\u2267","gEl;":"\u2A8C","gel;":"\u22DB","geq;":"\u2265","geqq;":"\u2267","geqslant;":"\u2A7E","gescc;":"\u2AA9","ges;":"\u2A7E","gesdot;":"\u2A80","gesdoto;":"\u2A82","gesdotol;":"\u2A84","gesl;":"\u22DB\uFE00","gesles;":"\u2A94","Gfr;":"\uD835\uDD0A","gfr;":"\uD835\uDD24","gg;":"\u226B","Gg;":"\u22D9","ggg;":"\u22D9","gimel;":"\u2137","GJcy;":"\u0403","gjcy;":"\u0453","gla;":"\u2AA5","gl;":"\u2277","glE;":"\u2A92","glj;":"\u2AA4","gnap;":"\u2A8A","gnapprox;":"\u2A8A","gne;":"\u2A88","gnE;":"\u2269","gneq;":"\u2A88","gneqq;":"\u2269","gnsim;":"\u22E7","Gopf;":"\uD835\uDD3E","gopf;":"\uD835\uDD58","grave;":"\u0060","GreaterEqual;":"\u2265","GreaterEqualLess;":"\u22DB","GreaterFullEqual;":"\u2267","GreaterGreater;":"\u2AA2","GreaterLess;":"\u2277","GreaterSlantEqual;":"\u2A7E","GreaterTilde;":"\u2273","Gscr;":"\uD835\uDCA2","gscr;":"\u210A","gsim;":"\u2273","gsime;":"\u2A8E","gsiml;":"\u2A90","gtcc;":"\u2AA7","gtcir;":"\u2A7A","GT;":"\u003E","GT":"\u003E","Gt;":"\u226B","gtdot;":"\u22D7","gtlPar;":"\u2995","gtquest;":"\u2A7C","gtrapprox;":"\u2A86","gtrarr;":"\u2978","gtrdot;":"\u22D7","gtreqless;":"\u22DB","gtreqqless;":"\u2A8C","gtrless;":"\u2277","gtrsim;":"\u2273","gvertneqq;":"\u2269\uFE00","gvnE;":"\u2269\uFE00","Hacek;":"\u02C7","hairsp;":"\u200A","half;":"\u00BD","hamilt;":"\u210B","HARDcy;":"\u042A","hardcy;":"\u044A","harrcir;":"\u2948","harrw;":"\u21AD","Hat;":"\u005E","hbar;":"\u210F","Hcirc;":"\u0124","hcirc;":"\u0125","heartsuit;":"\u2665","hercon;":"\u22B9","hfr;":"\uD835\uDD25","Hfr;":"\u210C","HilbertSpace;":"\u210B","hksearow;":"\u2925","hkswarow;":"\u2926","hoarr;":"\u21FF","homtht;":"\u223B","hookleftarrow;":"\u21A9","hookrightarrow;":"\u21AA","hopf;":"\uD835\uDD59","Hopf;":"\u210D","horbar;":"\u2015","HorizontalLine;":"\u2500","hscr;":"\uD835\uDCBD","Hscr;":"\u210B","hslash;":"\u210F","Hstrok;":"\u0126","hstrok;":"\u0127","HumpDownHump;":"\u224E","HumpEqual;":"\u224F","hybull;":"\u2043","hyphen;":"\u2010","ic;":"\u2063","Icy;":"\u0418","icy;":"\u0438","Idot;":"\u0130","IEcy;":"\u0415","iecy;":"\u0435","iff;":"\u21D4","ifr;":"\uD835\uDD26","Ifr;":"\u2111","ii;":"\u2148","iiiint;":"\u2A0C","iiint;":"\u222D","iinfin;":"\u29DC","iiota;":"\u2129","IJlig;":"\u0132","ijlig;":"\u0133","Imacr;":"\u012A","imacr;":"\u012B","ImaginaryI;":"\u2148","imagline;":"\u2110","imagpart;":"\u2111","imath;":"\u0131","Im;":"\u2111","imof;":"\u22B7","imped;":"\u01B5","Implies;":"\u21D2","incare;":"\u2105","in;":"\u2208","infintie;":"\u29DD","inodot;":"\u0131","intcal;":"\u22BA","Int;":"\u222C","integers;":"\u2124","Integral;":"\u222B","intercal;":"\u22BA","Intersection;":"\u22C2","intlarhk;":"\u2A17","intprod;":"\u2A3C","InvisibleComma;":"\u2063","InvisibleTimes;":"\u2062","IOcy;":"\u0401","iocy;":"\u0451","Iogon;":"\u012E","iogon;":"\u012F","Iopf;":"\uD835\uDD40","iopf;":"\uD835\uDD5A","iprod;":"\u2A3C","iscr;":"\uD835\uDCBE","Iscr;":"\u2110","isindot;":"\u22F5","isinE;":"\u22F9","isins;":"\u22F4","isinsv;":"\u22F3","isinv;":"\u2208","it;":"\u2062","Itilde;":"\u0128","itilde;":"\u0129","Iukcy;":"\u0406","iukcy;":"\u0456","Jcirc;":"\u0134","jcirc;":"\u0135","Jcy;":"\u0419","jcy;":"\u0439","Jfr;":"\uD835\uDD0D","jfr;":"\uD835\uDD27","jmath;":"\u0237","Jopf;":"\uD835\uDD41","jopf;":"\uD835\uDD5B","Jscr;":"\uD835\uDCA5","jscr;":"\uD835\uDCBF","Jsercy;":"\u0408","jsercy;":"\u0458","Jukcy;":"\u0404","jukcy;":"\u0454","kappav;":"\u03F0","Kcedil;":"\u0136","kcedil;":"\u0137","Kcy;":"\u041A","kcy;":"\u043A","Kfr;":"\uD835\uDD0E","kfr;":"\uD835\uDD28","kgreen;":"\u0138","KHcy;":"\u0425","khcy;":"\u0445","KJcy;":"\u040C","kjcy;":"\u045C","Kopf;":"\uD835\uDD42","kopf;":"\uD835\uDD5C","Kscr;":"\uD835\uDCA6","kscr;":"\uD835\uDCC0","lAarr;":"\u21DA","Lacute;":"\u0139","lacute;":"\u013A","laemptyv;":"\u29B4","lagran;":"\u2112","Lang;":"\u27EA","langd;":"\u2991","langle;":"\u27E8","lap;":"\u2A85","Laplacetrf;":"\u2112","larrb;":"\u21E4","larrbfs;":"\u291F","Larr;":"\u219E","larrfs;":"\u291D","larrhk;":"\u21A9","larrlp;":"\u21AB","larrpl;":"\u2939","larrsim;":"\u2973","larrtl;":"\u21A2","latail;":"\u2919","lAtail;":"\u291B","lat;":"\u2AAB","late;":"\u2AAD","lates;":"\u2AAD\uFE00","lbarr;":"\u290C","lBarr;":"\u290E","lbbrk;":"\u2772","lbrace;":"\u007B","lbrack;":"\u005B","lbrke;":"\u298B","lbrksld;":"\u298F","lbrkslu;":"\u298D","Lcaron;":"\u013D","lcaron;":"\u013E","Lcedil;":"\u013B","lcedil;":"\u013C","lcub;":"\u007B","Lcy;":"\u041B","lcy;":"\u043B","ldca;":"\u2936","ldquor;":"\u201E","ldrdhar;":"\u2967","ldrushar;":"\u294B","ldsh;":"\u21B2","lE;":"\u2266","LeftAngleBracket;":"\u27E8","LeftArrowBar;":"\u21E4","leftarrow;":"\u2190","LeftArrow;":"\u2190","Leftarrow;":"\u21D0","LeftArrowRightArrow;":"\u21C6","leftarrowtail;":"\u21A2","LeftCeiling;":"\u2308","LeftDoubleBracket;":"\u27E6","LeftDownTeeVector;":"\u2961","LeftDownVectorBar;":"\u2959","LeftDownVector;":"\u21C3","LeftFloor;":"\u230A","leftharpoondown;":"\u21BD","leftharpoonup;":"\u21BC","leftleftarrows;":"\u21C7","leftrightarrow;":"\u2194","LeftRightArrow;":"\u2194","Leftrightarrow;":"\u21D4","leftrightarrows;":"\u21C6","leftrightharpoons;":"\u21CB","leftrightsquigarrow;":"\u21AD","LeftRightVector;":"\u294E","LeftTeeArrow;":"\u21A4","LeftTee;":"\u22A3","LeftTeeVector;":"\u295A","leftthreetimes;":"\u22CB","LeftTriangleBar;":"\u29CF","LeftTriangle;":"\u22B2","LeftTriangleEqual;":"\u22B4","LeftUpDownVector;":"\u2951","LeftUpTeeVector;":"\u2960","LeftUpVectorBar;":"\u2958","LeftUpVector;":"\u21BF","LeftVectorBar;":"\u2952","LeftVector;":"\u21BC","lEg;":"\u2A8B","leg;":"\u22DA","leq;":"\u2264","leqq;":"\u2266","leqslant;":"\u2A7D","lescc;":"\u2AA8","les;":"\u2A7D","lesdot;":"\u2A7F","lesdoto;":"\u2A81","lesdotor;":"\u2A83","lesg;":"\u22DA\uFE00","lesges;":"\u2A93","lessapprox;":"\u2A85","lessdot;":"\u22D6","lesseqgtr;":"\u22DA","lesseqqgtr;":"\u2A8B","LessEqualGreater;":"\u22DA","LessFullEqual;":"\u2266","LessGreater;":"\u2276","lessgtr;":"\u2276","LessLess;":"\u2AA1","lesssim;":"\u2272","LessSlantEqual;":"\u2A7D","LessTilde;":"\u2272","lfisht;":"\u297C","Lfr;":"\uD835\uDD0F","lfr;":"\uD835\uDD29","lg;":"\u2276","lgE;":"\u2A91","lHar;":"\u2962","lhard;":"\u21BD","lharu;":"\u21BC","lharul;":"\u296A","lhblk;":"\u2584","LJcy;":"\u0409","ljcy;":"\u0459","llarr;":"\u21C7","ll;":"\u226A","Ll;":"\u22D8","llcorner;":"\u231E","Lleftarrow;":"\u21DA","llhard;":"\u296B","lltri;":"\u25FA","Lmidot;":"\u013F","lmidot;":"\u0140","lmoustache;":"\u23B0","lmoust;":"\u23B0","lnap;":"\u2A89","lnapprox;":"\u2A89","lne;":"\u2A87","lnE;":"\u2268","lneq;":"\u2A87","lneqq;":"\u2268","lnsim;":"\u22E6","loang;":"\u27EC","loarr;":"\u21FD","lobrk;":"\u27E6","longleftarrow;":"\u27F5","LongLeftArrow;":"\u27F5","Longleftarrow;":"\u27F8","longleftrightarrow;":"\u27F7","LongLeftRightArrow;":"\u27F7","Longleftrightarrow;":"\u27FA","longmapsto;":"\u27FC","longrightarrow;":"\u27F6","LongRightArrow;":"\u27F6","Longrightarrow;":"\u27F9","looparrowleft;":"\u21AB","looparrowright;":"\u21AC","lopar;":"\u2985","Lopf;":"\uD835\uDD43","lopf;":"\uD835\uDD5D","loplus;":"\u2A2D","lotimes;":"\u2A34","lowbar;":"\u005F","LowerLeftArrow;":"\u2199","LowerRightArrow;":"\u2198","lozenge;":"\u25CA","lozf;":"\u29EB","lpar;":"\u0028","lparlt;":"\u2993","lrarr;":"\u21C6","lrcorner;":"\u231F","lrhar;":"\u21CB","lrhard;":"\u296D","lrtri;":"\u22BF","lscr;":"\uD835\uDCC1","Lscr;":"\u2112","lsh;":"\u21B0","Lsh;":"\u21B0","lsim;":"\u2272","lsime;":"\u2A8D","lsimg;":"\u2A8F","lsqb;":"\u005B","lsquor;":"\u201A","Lstrok;":"\u0141","lstrok;":"\u0142","ltcc;":"\u2AA6","ltcir;":"\u2A79","LT;":"\u003C","LT":"\u003C","Lt;":"\u226A","ltdot;":"\u22D6","lthree;":"\u22CB","ltimes;":"\u22C9","ltlarr;":"\u2976","ltquest;":"\u2A7B","ltri;":"\u25C3","ltrie;":"\u22B4","ltrif;":"\u25C2","ltrPar;":"\u2996","lurdshar;":"\u294A","luruhar;":"\u2966","lvertneqq;":"\u2268\uFE00","lvnE;":"\u2268\uFE00","male;":"\u2642","malt;":"\u2720","maltese;":"\u2720","Map;":"\u2905","map;":"\u21A6","mapsto;":"\u21A6","mapstodown;":"\u21A7","mapstoleft;":"\u21A4","mapstoup;":"\u21A5","marker;":"\u25AE","mcomma;":"\u2A29","Mcy;":"\u041C","mcy;":"\u043C","mDDot;":"\u223A","measuredangle;":"\u2221","MediumSpace;":"\u205F","Mellintrf;":"\u2133","Mfr;":"\uD835\uDD10","mfr;":"\uD835\uDD2A","mho;":"\u2127","midast;":"\u002A","midcir;":"\u2AF0","mid;":"\u2223","minusb;":"\u229F","minusd;":"\u2238","minusdu;":"\u2A2A","MinusPlus;":"\u2213","mlcp;":"\u2ADB","mldr;":"\u2026","mnplus;":"\u2213","models;":"\u22A7","Mopf;":"\uD835\uDD44","mopf;":"\uD835\uDD5E","mp;":"\u2213","mscr;":"\uD835\uDCC2","Mscr;":"\u2133","mstpos;":"\u223E","multimap;":"\u22B8","mumap;":"\u22B8","Nacute;":"\u0143","nacute;":"\u0144","nang;":"\u2220\u20D2","nap;":"\u2249","napE;":"\u2A70\u0338","napid;":"\u224B\u0338","napos;":"\u0149","napprox;":"\u2249","natural;":"\u266E","naturals;":"\u2115","natur;":"\u266E","nbump;":"\u224E\u0338","nbumpe;":"\u224F\u0338","ncap;":"\u2A43","Ncaron;":"\u0147","ncaron;":"\u0148","Ncedil;":"\u0145","ncedil;":"\u0146","ncong;":"\u2247","ncongdot;":"\u2A6D\u0338","ncup;":"\u2A42","Ncy;":"\u041D","ncy;":"\u043D","nearhk;":"\u2924","nearr;":"\u2197","neArr;":"\u21D7","nearrow;":"\u2197","nedot;":"\u2250\u0338","NegativeMediumSpace;":"\u200B","NegativeThickSpace;":"\u200B","NegativeThinSpace;":"\u200B","NegativeVeryThinSpace;":"\u200B","nequiv;":"\u2262","nesear;":"\u2928","nesim;":"\u2242\u0338","NestedGreaterGreater;":"\u226B","NestedLessLess;":"\u226A","NewLine;":"\u000A","nexist;":"\u2204","nexists;":"\u2204","Nfr;":"\uD835\uDD11","nfr;":"\uD835\uDD2B","ngE;":"\u2267\u0338","nge;":"\u2271","ngeq;":"\u2271","ngeqq;":"\u2267\u0338","ngeqslant;":"\u2A7E\u0338","nges;":"\u2A7E\u0338","nGg;":"\u22D9\u0338","ngsim;":"\u2275","nGt;":"\u226B\u20D2","ngt;":"\u226F","ngtr;":"\u226F","nGtv;":"\u226B\u0338","nharr;":"\u21AE","nhArr;":"\u21CE","nhpar;":"\u2AF2","nis;":"\u22FC","nisd;":"\u22FA","niv;":"\u220B","NJcy;":"\u040A","njcy;":"\u045A","nlarr;":"\u219A","nlArr;":"\u21CD","nldr;":"\u2025","nlE;":"\u2266\u0338","nle;":"\u2270","nleftarrow;":"\u219A","nLeftarrow;":"\u21CD","nleftrightarrow;":"\u21AE","nLeftrightarrow;":"\u21CE","nleq;":"\u2270","nleqq;":"\u2266\u0338","nleqslant;":"\u2A7D\u0338","nles;":"\u2A7D\u0338","nless;":"\u226E","nLl;":"\u22D8\u0338","nlsim;":"\u2274","nLt;":"\u226A\u20D2","nlt;":"\u226E","nltri;":"\u22EA","nltrie;":"\u22EC","nLtv;":"\u226A\u0338","nmid;":"\u2224","NoBreak;":"\u2060","NonBreakingSpace;":"\u00A0","nopf;":"\uD835\uDD5F","Nopf;":"\u2115","Not;":"\u2AEC","NotCongruent;":"\u2262","NotCupCap;":"\u226D","NotDoubleVerticalBar;":"\u2226","NotElement;":"\u2209","NotEqual;":"\u2260","NotEqualTilde;":"\u2242\u0338","NotExists;":"\u2204","NotGreater;":"\u226F","NotGreaterEqual;":"\u2271","NotGreaterFullEqual;":"\u2267\u0338","NotGreaterGreater;":"\u226B\u0338","NotGreaterLess;":"\u2279","NotGreaterSlantEqual;":"\u2A7E\u0338","NotGreaterTilde;":"\u2275","NotHumpDownHump;":"\u224E\u0338","NotHumpEqual;":"\u224F\u0338","notindot;":"\u22F5\u0338","notinE;":"\u22F9\u0338","notinva;":"\u2209","notinvb;":"\u22F7","notinvc;":"\u22F6","NotLeftTriangleBar;":"\u29CF\u0338","NotLeftTriangle;":"\u22EA","NotLeftTriangleEqual;":"\u22EC","NotLess;":"\u226E","NotLessEqual;":"\u2270","NotLessGreater;":"\u2278","NotLessLess;":"\u226A\u0338","NotLessSlantEqual;":"\u2A7D\u0338","NotLessTilde;":"\u2274","NotNestedGreaterGreater;":"\u2AA2\u0338","NotNestedLessLess;":"\u2AA1\u0338","notni;":"\u220C","notniva;":"\u220C","notnivb;":"\u22FE","notnivc;":"\u22FD","NotPrecedes;":"\u2280","NotPrecedesEqual;":"\u2AAF\u0338","NotPrecedesSlantEqual;":"\u22E0","NotReverseElement;":"\u220C","NotRightTriangleBar;":"\u29D0\u0338","NotRightTriangle;":"\u22EB","NotRightTriangleEqual;":"\u22ED","NotSquareSubset;":"\u228F\u0338","NotSquareSubsetEqual;":"\u22E2","NotSquareSuperset;":"\u2290\u0338","NotSquareSupersetEqual;":"\u22E3","NotSubset;":"\u2282\u20D2","NotSubsetEqual;":"\u2288","NotSucceeds;":"\u2281","NotSucceedsEqual;":"\u2AB0\u0338","NotSucceedsSlantEqual;":"\u22E1","NotSucceedsTilde;":"\u227F\u0338","NotSuperset;":"\u2283\u20D2","NotSupersetEqual;":"\u2289","NotTilde;":"\u2241","NotTildeEqual;":"\u2244","NotTildeFullEqual;":"\u2247","NotTildeTilde;":"\u2249","NotVerticalBar;":"\u2224","nparallel;":"\u2226","npar;":"\u2226","nparsl;":"\u2AFD\u20E5","npart;":"\u2202\u0338","npolint;":"\u2A14","npr;":"\u2280","nprcue;":"\u22E0","nprec;":"\u2280","npreceq;":"\u2AAF\u0338","npre;":"\u2AAF\u0338","nrarrc;":"\u2933\u0338","nrarr;":"\u219B","nrArr;":"\u21CF","nrarrw;":"\u219D\u0338","nrightarrow;":"\u219B","nRightarrow;":"\u21CF","nrtri;":"\u22EB","nrtrie;":"\u22ED","nsc;":"\u2281","nsccue;":"\u22E1","nsce;":"\u2AB0\u0338","Nscr;":"\uD835\uDCA9","nscr;":"\uD835\uDCC3","nshortmid;":"\u2224","nshortparallel;":"\u2226","nsim;":"\u2241","nsime;":"\u2244","nsimeq;":"\u2244","nsmid;":"\u2224","nspar;":"\u2226","nsqsube;":"\u22E2","nsqsupe;":"\u22E3","nsubE;":"\u2AC5\u0338","nsube;":"\u2288","nsubset;":"\u2282\u20D2","nsubseteq;":"\u2288","nsubseteqq;":"\u2AC5\u0338","nsucc;":"\u2281","nsucceq;":"\u2AB0\u0338","nsup;":"\u2285","nsupE;":"\u2AC6\u0338","nsupe;":"\u2289","nsupset;":"\u2283\u20D2","nsupseteq;":"\u2289","nsupseteqq;":"\u2AC6\u0338","ntgl;":"\u2279","ntlg;":"\u2278","ntriangleleft;":"\u22EA","ntrianglelefteq;":"\u22EC","ntriangleright;":"\u22EB","ntrianglerighteq;":"\u22ED","num;":"\u0023","numero;":"\u2116","numsp;":"\u2007","nvap;":"\u224D\u20D2","nvdash;":"\u22AC","nvDash;":"\u22AD","nVdash;":"\u22AE","nVDash;":"\u22AF","nvge;":"\u2265\u20D2","nvgt;":"\u003E\u20D2","nvHarr;":"\u2904","nvinfin;":"\u29DE","nvlArr;":"\u2902","nvle;":"\u2264\u20D2","nvlt;":"\u003C\u20D2","nvltrie;":"\u22B4\u20D2","nvrArr;":"\u2903","nvrtrie;":"\u22B5\u20D2","nvsim;":"\u223C\u20D2","nwarhk;":"\u2923","nwarr;":"\u2196","nwArr;":"\u21D6","nwarrow;":"\u2196","nwnear;":"\u2927","oast;":"\u229B","ocir;":"\u229A","Ocy;":"\u041E","ocy;":"\u043E","odash;":"\u229D","Odblac;":"\u0150","odblac;":"\u0151","odiv;":"\u2A38","odot;":"\u2299","odsold;":"\u29BC","ofcir;":"\u29BF","Ofr;":"\uD835\uDD12","ofr;":"\uD835\uDD2C","ogon;":"\u02DB","ogt;":"\u29C1","ohbar;":"\u29B5","ohm;":"\u03A9","oint;":"\u222E","olarr;":"\u21BA","olcir;":"\u29BE","olcross;":"\u29BB","olt;":"\u29C0","Omacr;":"\u014C","omacr;":"\u014D","omid;":"\u29B6","ominus;":"\u2296","Oopf;":"\uD835\uDD46","oopf;":"\uD835\uDD60","opar;":"\u29B7","OpenCurlyDoubleQuote;":"\u201C","OpenCurlyQuote;":"\u2018","operp;":"\u29B9","orarr;":"\u21BB","Or;":"\u2A54","ord;":"\u2A5D","order;":"\u2134","orderof;":"\u2134","origof;":"\u22B6","oror;":"\u2A56","orslope;":"\u2A57","orv;":"\u2A5B","oS;":"\u24C8","Oscr;":"\uD835\uDCAA","oscr;":"\u2134","osol;":"\u2298","otimesas;":"\u2A36","Otimes;":"\u2A37","ovbar;":"\u233D","OverBar;":"\u203E","OverBrace;":"\u23DE","OverBracket;":"\u23B4","OverParenthesis;":"\u23DC","parallel;":"\u2225","par;":"\u2225","parsim;":"\u2AF3","parsl;":"\u2AFD","PartialD;":"\u2202","Pcy;":"\u041F","pcy;":"\u043F","percnt;":"\u0025","period;":"\u002E","pertenk;":"\u2031","Pfr;":"\uD835\uDD13","pfr;":"\uD835\uDD2D","phiv;":"\u03D5","phmmat;":"\u2133","phone;":"\u260E","pitchfork;":"\u22D4","planck;":"\u210F","planckh;":"\u210E","plankv;":"\u210F","plusacir;":"\u2A23","plusb;":"\u229E","pluscir;":"\u2A22","plus;":"\u002B","plusdo;":"\u2214","plusdu;":"\u2A25","pluse;":"\u2A72","PlusMinus;":"\u00B1","plussim;":"\u2A26","plustwo;":"\u2A27","pm;":"\u00B1","Poincareplane;":"\u210C","pointint;":"\u2A15","popf;":"\uD835\uDD61","Popf;":"\u2119","prap;":"\u2AB7","Pr;":"\u2ABB","pr;":"\u227A","prcue;":"\u227C","precapprox;":"\u2AB7","prec;":"\u227A","preccurlyeq;":"\u227C","Precedes;":"\u227A","PrecedesEqual;":"\u2AAF","PrecedesSlantEqual;":"\u227C","PrecedesTilde;":"\u227E","preceq;":"\u2AAF","precnapprox;":"\u2AB9","precneqq;":"\u2AB5","precnsim;":"\u22E8","pre;":"\u2AAF","prE;":"\u2AB3","precsim;":"\u227E","primes;":"\u2119","prnap;":"\u2AB9","prnE;":"\u2AB5","prnsim;":"\u22E8","Product;":"\u220F","profalar;":"\u232E","profline;":"\u2312","profsurf;":"\u2313","Proportional;":"\u221D","Proportion;":"\u2237","propto;":"\u221D","prsim;":"\u227E","prurel;":"\u22B0","Pscr;":"\uD835\uDCAB","pscr;":"\uD835\uDCC5","puncsp;":"\u2008","Qfr;":"\uD835\uDD14","qfr;":"\uD835\uDD2E","qint;":"\u2A0C","qopf;":"\uD835\uDD62","Qopf;":"\u211A","qprime;":"\u2057","Qscr;":"\uD835\uDCAC","qscr;":"\uD835\uDCC6","quaternions;":"\u210D","quatint;":"\u2A16","quest;":"\u003F","questeq;":"\u225F","QUOT;":"\u0022","QUOT":"\u0022","rAarr;":"\u21DB","race;":"\u223D\u0331","Racute;":"\u0154","racute;":"\u0155","raemptyv;":"\u29B3","Rang;":"\u27EB","rangd;":"\u2992","range;":"\u29A5","rangle;":"\u27E9","rarrap;":"\u2975","rarrb;":"\u21E5","rarrbfs;":"\u2920","rarrc;":"\u2933","Rarr;":"\u21A0","rarrfs;":"\u291E","rarrhk;":"\u21AA","rarrlp;":"\u21AC","rarrpl;":"\u2945","rarrsim;":"\u2974","Rarrtl;":"\u2916","rarrtl;":"\u21A3","rarrw;":"\u219D","ratail;":"\u291A","rAtail;":"\u291C","ratio;":"\u2236","rationals;":"\u211A","rbarr;":"\u290D","rBarr;":"\u290F","RBarr;":"\u2910","rbbrk;":"\u2773","rbrace;":"\u007D","rbrack;":"\u005D","rbrke;":"\u298C","rbrksld;":"\u298E","rbrkslu;":"\u2990","Rcaron;":"\u0158","rcaron;":"\u0159","Rcedil;":"\u0156","rcedil;":"\u0157","rcub;":"\u007D","Rcy;":"\u0420","rcy;":"\u0440","rdca;":"\u2937","rdldhar;":"\u2969","rdquor;":"\u201D","rdsh;":"\u21B3","realine;":"\u211B","realpart;":"\u211C","reals;":"\u211D","Re;":"\u211C","rect;":"\u25AD","REG;":"\u00AE","REG":"\u00AE","ReverseElement;":"\u220B","ReverseEquilibrium;":"\u21CB","ReverseUpEquilibrium;":"\u296F","rfisht;":"\u297D","rfr;":"\uD835\uDD2F","Rfr;":"\u211C","rHar;":"\u2964","rhard;":"\u21C1","rharu;":"\u21C0","rharul;":"\u296C","rhov;":"\u03F1","RightAngleBracket;":"\u27E9","RightArrowBar;":"\u21E5","rightarrow;":"\u2192","RightArrow;":"\u2192","Rightarrow;":"\u21D2","RightArrowLeftArrow;":"\u21C4","rightarrowtail;":"\u21A3","RightCeiling;":"\u2309","RightDoubleBracket;":"\u27E7","RightDownTeeVector;":"\u295D","RightDownVectorBar;":"\u2955","RightDownVector;":"\u21C2","RightFloor;":"\u230B","rightharpoondown;":"\u21C1","rightharpoonup;":"\u21C0","rightleftarrows;":"\u21C4","rightleftharpoons;":"\u21CC","rightrightarrows;":"\u21C9","rightsquigarrow;":"\u219D","RightTeeArrow;":"\u21A6","RightTee;":"\u22A2","RightTeeVector;":"\u295B","rightthreetimes;":"\u22CC","RightTriangleBar;":"\u29D0","RightTriangle;":"\u22B3","RightTriangleEqual;":"\u22B5","RightUpDownVector;":"\u294F","RightUpTeeVector;":"\u295C","RightUpVectorBar;":"\u2954","RightUpVector;":"\u21BE","RightVectorBar;":"\u2953","RightVector;":"\u21C0","ring;":"\u02DA","risingdotseq;":"\u2253","rlarr;":"\u21C4","rlhar;":"\u21CC","rmoustache;":"\u23B1","rmoust;":"\u23B1","rnmid;":"\u2AEE","roang;":"\u27ED","roarr;":"\u21FE","robrk;":"\u27E7","ropar;":"\u2986","ropf;":"\uD835\uDD63","Ropf;":"\u211D","roplus;":"\u2A2E","rotimes;":"\u2A35","RoundImplies;":"\u2970","rpar;":"\u0029","rpargt;":"\u2994","rppolint;":"\u2A12","rrarr;":"\u21C9","Rrightarrow;":"\u21DB","rscr;":"\uD835\uDCC7","Rscr;":"\u211B","rsh;":"\u21B1","Rsh;":"\u21B1","rsqb;":"\u005D","rsquor;":"\u2019","rthree;":"\u22CC","rtimes;":"\u22CA","rtri;":"\u25B9","rtrie;":"\u22B5","rtrif;":"\u25B8","rtriltri;":"\u29CE","RuleDelayed;":"\u29F4","ruluhar;":"\u2968","rx;":"\u211E","Sacute;":"\u015A","sacute;":"\u015B","scap;":"\u2AB8","Sc;":"\u2ABC","sc;":"\u227B","sccue;":"\u227D","sce;":"\u2AB0","scE;":"\u2AB4","Scedil;":"\u015E","scedil;":"\u015F","Scirc;":"\u015C","scirc;":"\u015D","scnap;":"\u2ABA","scnE;":"\u2AB6","scnsim;":"\u22E9","scpolint;":"\u2A13","scsim;":"\u227F","Scy;":"\u0421","scy;":"\u0441","sdotb;":"\u22A1","sdote;":"\u2A66","searhk;":"\u2925","searr;":"\u2198","seArr;":"\u21D8","searrow;":"\u2198","semi;":"\u003B","seswar;":"\u2929","setminus;":"\u2216","setmn;":"\u2216","sext;":"\u2736","Sfr;":"\uD835\uDD16","sfr;":"\uD835\uDD30","sfrown;":"\u2322","sharp;":"\u266F","SHCHcy;":"\u0429","shchcy;":"\u0449","SHcy;":"\u0428","shcy;":"\u0448","ShortDownArrow;":"\u2193","ShortLeftArrow;":"\u2190","shortmid;":"\u2223","shortparallel;":"\u2225","ShortRightArrow;":"\u2192","ShortUpArrow;":"\u2191","sigmav;":"\u03C2","simdot;":"\u2A6A","sime;":"\u2243","simeq;":"\u2243","simg;":"\u2A9E","simgE;":"\u2AA0","siml;":"\u2A9D","simlE;":"\u2A9F","simne;":"\u2246","simplus;":"\u2A24","simrarr;":"\u2972","slarr;":"\u2190","SmallCircle;":"\u2218","smallsetminus;":"\u2216","smashp;":"\u2A33","smeparsl;":"\u29E4","smid;":"\u2223","smile;":"\u2323","smt;":"\u2AAA","smte;":"\u2AAC","smtes;":"\u2AAC\uFE00","SOFTcy;":"\u042C","softcy;":"\u044C","solbar;":"\u233F","solb;":"\u29C4","sol;":"\u002F","Sopf;":"\uD835\uDD4A","sopf;":"\uD835\uDD64","spadesuit;":"\u2660","spar;":"\u2225","sqcap;":"\u2293","sqcaps;":"\u2293\uFE00","sqcup;":"\u2294","sqcups;":"\u2294\uFE00","Sqrt;":"\u221A","sqsub;":"\u228F","sqsube;":"\u2291","sqsubset;":"\u228F","sqsubseteq;":"\u2291","sqsup;":"\u2290","sqsupe;":"\u2292","sqsupset;":"\u2290","sqsupseteq;":"\u2292","square;":"\u25A1","Square;":"\u25A1","SquareIntersection;":"\u2293","SquareSubset;":"\u228F","SquareSubsetEqual;":"\u2291","SquareSuperset;":"\u2290","SquareSupersetEqual;":"\u2292","SquareUnion;":"\u2294","squarf;":"\u25AA","squ;":"\u25A1","squf;":"\u25AA","srarr;":"\u2192","Sscr;":"\uD835\uDCAE","sscr;":"\uD835\uDCC8","ssetmn;":"\u2216","ssmile;":"\u2323","sstarf;":"\u22C6","Star;":"\u22C6","star;":"\u2606","starf;":"\u2605","straightepsilon;":"\u03F5","straightphi;":"\u03D5","strns;":"\u00AF","Sub;":"\u22D0","subdot;":"\u2ABD","subE;":"\u2AC5","subedot;":"\u2AC3","submult;":"\u2AC1","subnE;":"\u2ACB","subne;":"\u228A","subplus;":"\u2ABF","subrarr;":"\u2979","subset;":"\u2282","Subset;":"\u22D0","subseteq;":"\u2286","subseteqq;":"\u2AC5","SubsetEqual;":"\u2286","subsetneq;":"\u228A","subsetneqq;":"\u2ACB","subsim;":"\u2AC7","subsub;":"\u2AD5","subsup;":"\u2AD3","succapprox;":"\u2AB8","succ;":"\u227B","succcurlyeq;":"\u227D","Succeeds;":"\u227B","SucceedsEqual;":"\u2AB0","SucceedsSlantEqual;":"\u227D","SucceedsTilde;":"\u227F","succeq;":"\u2AB0","succnapprox;":"\u2ABA","succneqq;":"\u2AB6","succnsim;":"\u22E9","succsim;":"\u227F","SuchThat;":"\u220B","Sum;":"\u2211","sung;":"\u266A","Sup;":"\u22D1","supdot;":"\u2ABE","supdsub;":"\u2AD8","supE;":"\u2AC6","supedot;":"\u2AC4","Superset;":"\u2283","SupersetEqual;":"\u2287","suphsol;":"\u27C9","suphsub;":"\u2AD7","suplarr;":"\u297B","supmult;":"\u2AC2","supnE;":"\u2ACC","supne;":"\u228B","supplus;":"\u2AC0","supset;":"\u2283","Supset;":"\u22D1","supseteq;":"\u2287","supseteqq;":"\u2AC6","supsetneq;":"\u228B","supsetneqq;":"\u2ACC","supsim;":"\u2AC8","supsub;":"\u2AD4","supsup;":"\u2AD6","swarhk;":"\u2926","swarr;":"\u2199","swArr;":"\u21D9","swarrow;":"\u2199","swnwar;":"\u292A","Tab;":"\u0009","target;":"\u2316","tbrk;":"\u23B4","Tcaron;":"\u0164","tcaron;":"\u0165","Tcedil;":"\u0162","tcedil;":"\u0163","Tcy;":"\u0422","tcy;":"\u0442","tdot;":"\u20DB","telrec;":"\u2315","Tfr;":"\uD835\uDD17","tfr;":"\uD835\uDD31","therefore;":"\u2234","Therefore;":"\u2234","thetav;":"\u03D1","thickapprox;":"\u2248","thicksim;":"\u223C","ThickSpace;":"\u205F\u200A","ThinSpace;":"\u2009","thkap;":"\u2248","thksim;":"\u223C","Tilde;":"\u223C","TildeEqual;":"\u2243","TildeFullEqual;":"\u2245","TildeTilde;":"\u2248","timesbar;":"\u2A31","timesb;":"\u22A0","timesd;":"\u2A30","tint;":"\u222D","toea;":"\u2928","topbot;":"\u2336","topcir;":"\u2AF1","top;":"\u22A4","Topf;":"\uD835\uDD4B","topf;":"\uD835\uDD65","topfork;":"\u2ADA","tosa;":"\u2929","tprime;":"\u2034","TRADE;":"\u2122","triangle;":"\u25B5","triangledown;":"\u25BF","triangleleft;":"\u25C3","trianglelefteq;":"\u22B4","triangleq;":"\u225C","triangleright;":"\u25B9","trianglerighteq;":"\u22B5","tridot;":"\u25EC","trie;":"\u225C","triminus;":"\u2A3A","TripleDot;":"\u20DB","triplus;":"\u2A39","trisb;":"\u29CD","tritime;":"\u2A3B","trpezium;":"\u23E2","Tscr;":"\uD835\uDCAF","tscr;":"\uD835\uDCC9","TScy;":"\u0426","tscy;":"\u0446","TSHcy;":"\u040B","tshcy;":"\u045B","Tstrok;":"\u0166","tstrok;":"\u0167","twixt;":"\u226C","twoheadleftarrow;":"\u219E","twoheadrightarrow;":"\u21A0","Uarr;":"\u219F","Uarrocir;":"\u2949","Ubrcy;":"\u040E","ubrcy;":"\u045E","Ubreve;":"\u016C","ubreve;":"\u016D","Ucy;":"\u0423","ucy;":"\u0443","udarr;":"\u21C5","Udblac;":"\u0170","udblac;":"\u0171","udhar;":"\u296E","ufisht;":"\u297E","Ufr;":"\uD835\uDD18","ufr;":"\uD835\uDD32","uHar;":"\u2963","uharl;":"\u21BF","uharr;":"\u21BE","uhblk;":"\u2580","ulcorn;":"\u231C","ulcorner;":"\u231C","ulcrop;":"\u230F","ultri;":"\u25F8","Umacr;":"\u016A","umacr;":"\u016B","UnderBar;":"\u005F","UnderBrace;":"\u23DF","UnderBracket;":"\u23B5","UnderParenthesis;":"\u23DD","Union;":"\u22C3","UnionPlus;":"\u228E","Uogon;":"\u0172","uogon;":"\u0173","Uopf;":"\uD835\uDD4C","uopf;":"\uD835\uDD66","UpArrowBar;":"\u2912","uparrow;":"\u2191","UpArrow;":"\u2191","Uparrow;":"\u21D1","UpArrowDownArrow;":"\u21C5","updownarrow;":"\u2195","UpDownArrow;":"\u2195","Updownarrow;":"\u21D5","UpEquilibrium;":"\u296E","upharpoonleft;":"\u21BF","upharpoonright;":"\u21BE","uplus;":"\u228E","UpperLeftArrow;":"\u2196","UpperRightArrow;":"\u2197","upsi;":"\u03C5","Upsi;":"\u03D2","UpTeeArrow;":"\u21A5","UpTee;":"\u22A5","upuparrows;":"\u21C8","urcorn;":"\u231D","urcorner;":"\u231D","urcrop;":"\u230E","Uring;":"\u016E","uring;":"\u016F","urtri;":"\u25F9","Uscr;":"\uD835\uDCB0","uscr;":"\uD835\uDCCA","utdot;":"\u22F0","Utilde;":"\u0168","utilde;":"\u0169","utri;":"\u25B5","utrif;":"\u25B4","uuarr;":"\u21C8","uwangle;":"\u29A7","vangrt;":"\u299C","varepsilon;":"\u03F5","varkappa;":"\u03F0","varnothing;":"\u2205","varphi;":"\u03D5","varpi;":"\u03D6","varpropto;":"\u221D","varr;":"\u2195","vArr;":"\u21D5","varrho;":"\u03F1","varsigma;":"\u03C2","varsubsetneq;":"\u228A\uFE00","varsubsetneqq;":"\u2ACB\uFE00","varsupsetneq;":"\u228B\uFE00","varsupsetneqq;":"\u2ACC\uFE00","vartheta;":"\u03D1","vartriangleleft;":"\u22B2","vartriangleright;":"\u22B3","vBar;":"\u2AE8","Vbar;":"\u2AEB","vBarv;":"\u2AE9","Vcy;":"\u0412","vcy;":"\u0432","vdash;":"\u22A2","vDash;":"\u22A8","Vdash;":"\u22A9","VDash;":"\u22AB","Vdashl;":"\u2AE6","veebar;":"\u22BB","vee;":"\u2228","Vee;":"\u22C1","veeeq;":"\u225A","vellip;":"\u22EE","verbar;":"\u007C","Verbar;":"\u2016","vert;":"\u007C","Vert;":"\u2016","VerticalBar;":"\u2223","VerticalLine;":"\u007C","VerticalSeparator;":"\u2758","VerticalTilde;":"\u2240","VeryThinSpace;":"\u200A","Vfr;":"\uD835\uDD19","vfr;":"\uD835\uDD33","vltri;":"\u22B2","vnsub;":"\u2282\u20D2","vnsup;":"\u2283\u20D2","Vopf;":"\uD835\uDD4D","vopf;":"\uD835\uDD67","vprop;":"\u221D","vrtri;":"\u22B3","Vscr;":"\uD835\uDCB1","vscr;":"\uD835\uDCCB","vsubnE;":"\u2ACB\uFE00","vsubne;":"\u228A\uFE00","vsupnE;":"\u2ACC\uFE00","vsupne;":"\u228B\uFE00","Vvdash;":"\u22AA","vzigzag;":"\u299A","Wcirc;":"\u0174","wcirc;":"\u0175","wedbar;":"\u2A5F","wedge;":"\u2227","Wedge;":"\u22C0","wedgeq;":"\u2259","Wfr;":"\uD835\uDD1A","wfr;":"\uD835\uDD34","Wopf;":"\uD835\uDD4E","wopf;":"\uD835\uDD68","wp;":"\u2118","wr;":"\u2240","wreath;":"\u2240","Wscr;":"\uD835\uDCB2","wscr;":"\uD835\uDCCC","xcap;":"\u22C2","xcirc;":"\u25EF","xcup;":"\u22C3","xdtri;":"\u25BD","Xfr;":"\uD835\uDD1B","xfr;":"\uD835\uDD35","xharr;":"\u27F7","xhArr;":"\u27FA","xlarr;":"\u27F5","xlArr;":"\u27F8","xmap;":"\u27FC","xnis;":"\u22FB","xodot;":"\u2A00","Xopf;":"\uD835\uDD4F","xopf;":"\uD835\uDD69","xoplus;":"\u2A01","xotime;":"\u2A02","xrarr;":"\u27F6","xrArr;":"\u27F9","Xscr;":"\uD835\uDCB3","xscr;":"\uD835\uDCCD","xsqcup;":"\u2A06","xuplus;":"\u2A04","xutri;":"\u25B3","xvee;":"\u22C1","xwedge;":"\u22C0","YAcy;":"\u042F","yacy;":"\u044F","Ycirc;":"\u0176","ycirc;":"\u0177","Ycy;":"\u042B","ycy;":"\u044B","Yfr;":"\uD835\uDD1C","yfr;":"\uD835\uDD36","YIcy;":"\u0407","yicy;":"\u0457","Yopf;":"\uD835\uDD50","yopf;":"\uD835\uDD6A","Yscr;":"\uD835\uDCB4","yscr;":"\uD835\uDCCE","YUcy;":"\u042E","yucy;":"\u044E","Zacute;":"\u0179","zacute;":"\u017A","Zcaron;":"\u017D","zcaron;":"\u017E","Zcy;":"\u0417","zcy;":"\u0437","Zdot;":"\u017B","zdot;":"\u017C","zeetrf;":"\u2128","ZeroWidthSpace;":"\u200B","zfr;":"\uD835\uDD37","Zfr;":"\u2128","ZHcy;":"\u0416","zhcy;":"\u0436","zigrarr;":"\u21DD","zopf;":"\uD835\uDD6B","Zopf;":"\u2124","Zscr;":"\uD835\uDCB5","zscr;":"\uD835\uDCCF"}
},{}],29:[function(require,module,exports){
module.exports={"amp;":"\u0026","apos;":"\u0027","gt;":"\u003e","lt;":"\u003c","quot;":"\u0022"}
},{}],30:[function(require,module,exports){
var modes = ["XML", "HTML4", "HTML5"];

module.exports = {
	decode: function(data, level){
		if(!modes[level]) level = 0;
		return module.exports["decode" + modes[level]](data);
	},
	decodeStrict: function(data, level){
		if(!modes[level]) level = 0;
		return module.exports["decode" + modes[level] + "Strict"](data);
	},
	encode: function(data, level){
		if(!modes[level]) level = 0;
		return module.exports["encode" + modes[level]](data);
	}
};

var _emods = {};
_emods["xml"] = require("./entities/xml.json");
_emods["html4"] = require("./entities/html4.json");
_emods["html5"] = require("./entities/html5.json");
modes.reduce(function(prev, name){
	var obj = _emods[name.toLowerCase()];

	if(prev){
		Object.keys(prev).forEach(function(name){
			obj[name] = prev[name];
		});
	}

	module.exports["decode" + name + "Strict"] = getStrictReplacer(obj);

	if(name === "XML"){
		//there is no non-strict mode for XML
		module.exports.decodeXML = module.exports.decodeXMLStrict;
	} else {
		module.exports["decode" + name] = getReplacer(obj);
	}

	module.exports["encode" + name] = getReverse(obj);

	return obj;
}, null);

function getReplacer(obj){
	var keys = Object.keys(obj).sort();
	var re = keys.join("|").replace(/(\w+)\|\1;/g, "$1;?");

	// also match hex and char codes
	re += "|#[xX][\\da-fA-F]+;?|#\\d+;?";

	return genReplaceFunc(
		new RegExp("&(?:" + re + ")", "g"),
		function func(name){
			if(name.charAt(1) === "#"){
				if(name.charAt(2).toLowerCase() === "x"){
					return String.fromCharCode(parseInt(name.substr(3), 16));
				}
				return String.fromCharCode(parseInt(name.substr(2), 10));
			}
			return obj[name.substr(1)];
		}
	);
}

function getStrictReplacer(obj){
	var keys = Object.keys(obj).sort().filter(RegExp.prototype.test, /;$/);
	var re = keys.map(function(name){
		return name.slice(0, -1); //remove trailing semicolon
	}).join("|");

	// also match hex and char codes
	re += "|#[xX][\\da-fA-F]+|#\\d+";

	var expr = new RegExp("&(?:" + re + ");", "g");

	return genReplaceFunc(expr, func);

	function func(name){
			if(name.charAt(1) === "#"){
				if(name.charAt(2).toLowerCase() === "x"){
					return String.fromCharCode(parseInt(name.substr(3), 16));
				}
				return String.fromCharCode(parseInt(name.substr(2), 10));
			}
			return obj[name.substr(1)];
		}
}

var re_nonASCII = /[^\0-\x7F]/g,
    re_astralSymbols = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

function nonUTF8Replacer(c){
	return "&#x" + c.charCodeAt(0).toString(16).toUpperCase() + ";";
}

function astralReplacer(c){
	// http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
	var high = c.charCodeAt(0);
	var low  = c.charCodeAt(1);
	var codePoint = (high - 0xD800) * 0x400 + low - 0xDC00 + 0x10000;
	return "&#x" + codePoint.toString(16).toUpperCase() + ";";
}

function getReverse(obj){
	var reverse = Object.keys(obj).filter(function(name){
		//prefer identifiers with a semicolon
		return name.substr(-1) === ";" || obj[name + ";"] !== obj[name];
	}).reduce(function(reverse, name){
		reverse[obj[name]] = name;
		return reverse;
	}, {});

	var regex = new RegExp("\\" + Object.keys(reverse).sort().join("|\\"), "g");
	function func(name){
		return "&" + reverse[name];
	}

	return function(data){
		return (data + "")
				.replace(regex, func)
				.replace(re_astralSymbols, astralReplacer)
				.replace(re_nonASCII, nonUTF8Replacer);
	};
}

function genReplaceFunc(regex, func){
	return function(data){
		return (data + "")
				.replace(regex, func);
	};
}

},{"./entities/html4.json":27,"./entities/html5.json":28,"./entities/xml.json":29}],31:[function(require,module,exports){
module.exports = CollectingHandler;

function CollectingHandler(cbs){
	this._cbs = cbs || {};
	this.events = [];
}

var EVENTS = require("./").EVENTS;
Object.keys(EVENTS).forEach(function(name){
	if(EVENTS[name] === 0){
		name = "on" + name;
		CollectingHandler.prototype[name] = function(){
			this.events.push([name]);
			if(this._cbs[name]) this._cbs[name]();
		};
	} else if(EVENTS[name] === 1){
		name = "on" + name;
		CollectingHandler.prototype[name] = function(a){
			this.events.push([name, a]);
			if(this._cbs[name]) this._cbs[name](a);
		};
	} else if(EVENTS[name] === 2){
		name = "on" + name;
		CollectingHandler.prototype[name] = function(a, b){
			this.events.push([name, a, b]);
			if(this._cbs[name]) this._cbs[name](a, b);
		};
	} else {
		throw Error("wrong number of arguments");
	}
});

CollectingHandler.prototype.onreset = function(){
	this.events = [];
	if(this._cbs.onreset) this._cbs.onreset();
};

CollectingHandler.prototype.restart = function(){
	if(this._cbs.onreset) this._cbs.onreset();

	for(var i = 0, len = this.events.length; i < len; i++){
		if(this._cbs[this.events[i][0]]){

			var num = this.events[i].length;

			if(num === 1){
				this._cbs[this.events[i][0]]();
			} else if(num === 2){
				this._cbs[this.events[i][0]](this.events[i][1]);
			} else {
				this._cbs[this.events[i][0]](this.events[i][1], this.events[i][2]);
			}
		}
	}
};

},{"./":40}],32:[function(require,module,exports){
var index = require("./index.js"),
    DomHandler = index.DomHandler,
	DomUtils = index.DomUtils;

//TODO: make this a streamable handler
function FeedHandler(callback, options){
	this.init(callback, options);
}

require("util").inherits(FeedHandler, DomHandler);

FeedHandler.prototype.init = DomHandler;

function getElements(what, where){
	return DomUtils.getElementsByTagName(what, where, true);
}
function getOneElement(what, where){
	return DomUtils.getElementsByTagName(what, where, true, 1)[0];
}
function fetch(what, where, recurse){
	return DomUtils.getText(
		DomUtils.getElementsByTagName(what, where, recurse, 1)
	).trim();
}

function addConditionally(obj, prop, what, where, recurse){
	var tmp = fetch(what, where, recurse);
	if(tmp) obj[prop] = tmp;
}

var isValidFeed = function(value) {
	return value === "rss" || value === "feed" || value === "rdf:RDF";
};

FeedHandler.prototype.onend = function() {
	var feed = {},
		feedRoot = getOneElement(isValidFeed, this.dom),
		tmp, childs;

	if (feedRoot) {
		if(feedRoot.name === "feed"){
			childs = feedRoot.children;

			feed.type = "atom";
			addConditionally(feed, "id", "id", childs);
			addConditionally(feed, "title", "title", childs);
			if((tmp = getOneElement("link", childs)) && (tmp = tmp.attribs) && (tmp = tmp.href)) feed.link = tmp;
			addConditionally(feed, "description", "subtitle", childs);
			if((tmp = fetch("updated", childs))) feed.updated = new Date(tmp);
			addConditionally(feed, "author", "email", childs, true);

			feed.items = getElements("entry", childs).map(function(item){
				var entry = {}, tmp;

				item = item.children;

				addConditionally(entry, "id", "id", item);
				addConditionally(entry, "title", "title", item);
				if((tmp = getOneElement("link", item)) && (tmp = tmp.attribs) && (tmp = tmp.href)) entry.link = tmp;
				addConditionally(entry, "description", "summary", item);
				if((tmp = fetch("updated", item))) entry.pubDate = new Date(tmp);
				return entry;
			});
		} else{
			childs = getOneElement("channel", feedRoot.children).children;

			feed.type = feedRoot.name.substr(0, 3);
			feed.id = "";
			addConditionally(feed, "title", "title", childs);
			addConditionally(feed, "link", "link", childs);
			addConditionally(feed, "description", "description", childs);
			if((tmp = fetch("lastBuildDate", childs))) feed.updated = new Date(tmp);
			addConditionally(feed, "author", "managingEditor", childs, true);

			feed.items = getElements("item", feedRoot.children).map(function(item){
				var entry = {}, tmp;

				item = item.children;

				addConditionally(entry, "id", "guid", item);
				addConditionally(entry, "title", "title", item);
				addConditionally(entry, "link", "link", item);
				addConditionally(entry, "description", "description", item);
				if((tmp = fetch("pubDate", item))) entry.pubDate = new Date(tmp);
				return entry;
			});
		}
	}
	this.dom = feed;
	DomHandler.prototype._handleCallback.call(
		this, feedRoot ? null : Error("couldn't find root of feed")
	);
};

module.exports = FeedHandler;

},{"./index.js":40,"util":52}],33:[function(require,module,exports){
var Tokenizer = require("./Tokenizer.js");

/*
	Options:

	xmlMode: Special behavior for script/style tags (true by default)
	lowerCaseAttributeNames: call .toLowerCase for each attribute name (true if xmlMode is `false`)
	lowerCaseTags: call .toLowerCase for each tag name (true if xmlMode is `false`)
*/

/*
	Callbacks:

	oncdataend,
	oncdatastart,
	onclosetag,
	oncomment,
	oncommentend,
	onerror,
	onopentag,
	onprocessinginstruction,
	onreset,
	ontext
*/

var formTags = {
	input: true,
	option: true,
	optgroup: true,
	select: true,
	button: true,
	datalist: true,
	textarea: true
};

var openImpliesClose = {
	tr      : { tr:true, th:true, td:true },
	th      : { th:true },
	td      : { thead:true, td:true },
	body    : { head:true, link:true, script:true },
	li      : { li:true },
	p       : { p:true },
	select  : formTags,
	input   : formTags,
	output  : formTags,
	button  : formTags,
	datalist: formTags,
	textarea: formTags,
	option  : { option:true },
	optgroup: { optgroup:true }
};

var voidElements = {
	__proto__: null,
	area: true,
	base: true,
	basefont: true,
	br: true,
	col: true,
	command: true,
	embed: true,
	frame: true,
	hr: true,
	img: true,
	input: true,
	isindex: true,
	keygen: true,
	link: true,
	meta: true,
	param: true,
	source: true,
	track: true,
	wbr: true
};

var re_nameEnd = /\s|\//;

function Parser(cbs, options){
	this._options = options || {};
	this._cbs = cbs || {};

	this._tagname = "";
	this._attribname = "";
	this._attribvalue = "";
	this._attribs = null;
	this._stack = [];
	this._done = false;

	this.startIndex = 0;
	this.endIndex = null;

	this._tokenizer = new Tokenizer(options, this);
}

require("util").inherits(Parser, require("events").EventEmitter);

Parser.prototype._updatePosition = function(initialOffset){
	if(this.endIndex === null){
		this.startIndex = this._tokenizer._sectionStart <= initialOffset ? 0 : this._tokenizer._sectionStart - initialOffset;
	}
	this.startIndex = this.endIndex + 1;
	this.endIndex = this._tokenizer._index;
};

//Tokenizer event handlers
Parser.prototype.ontext = function(data){
	this._updatePosition(1);
	this.endIndex--;

	if(this._cbs.ontext) this._cbs.ontext(data);
};

Parser.prototype.onopentagname = function(name){
	if(!(this._options.xmlMode || "lowerCaseTags" in this._options) || this._options.lowerCaseTags){
		name = name.toLowerCase();
	}

	this._tagname = name;

	if (!this._options.xmlMode && name in openImpliesClose) {
		for(
			var el;
			(el = this._stack[this._stack.length-1]) in openImpliesClose[name];
			this.onclosetag(el)
		);
	}

	if(this._options.xmlMode || !(name in voidElements)){
		this._stack.push(name);
	}

	if(this._cbs.onopentagname) this._cbs.onopentagname(name);
	if(this._cbs.onopentag) this._attribs = {};
};

Parser.prototype.onopentagend = function(){
	this._updatePosition(1);
    
	if(this._attribs){
		if(this._cbs.onopentag) this._cbs.onopentag(this._tagname, this._attribs);
		this._attribs = null;
	}
    
	if(!this._options.xmlMode && this._cbs.onclosetag && this._tagname in voidElements){
		this._cbs.onclosetag(this._tagname);
	}
    
	this._tagname = "";
};

Parser.prototype.onclosetag = function(name){
	this._updatePosition(1);

	if(!(this._options.xmlMode || "lowerCaseTags" in this._options) || this._options.lowerCaseTags){
		name = name.toLowerCase();
	}

	if(this._stack.length && (!(name in voidElements) || this._options.xmlMode)){
		var pos = this._stack.lastIndexOf(name);
		if(pos !== -1){
			if(this._cbs.onclosetag){
				pos = this._stack.length - pos;
				while(pos--) this._cbs.onclosetag(this._stack.pop());
			}
			else this._stack.length = pos;
		} else if(name === "p" && !this._options.xmlMode){
			this.onopentagname(name);
			this._closeCurrentTag();
		}
	} else if(!this._options.xmlMode && (name === "br" || name === "p")){
		this.onopentagname(name);
		this._closeCurrentTag();
	}
};

Parser.prototype.onselfclosingtag = function(){
	if(this._options.xmlMode){
		this._closeCurrentTag();
	} else {
		this.onopentagend();
	}
};

Parser.prototype._closeCurrentTag = function(){
	var name = this._tagname;

	this.onopentagend();

	//self-closing tags will be on the top of the stack
	//(cheaper check than in onclosetag)
	if(this._stack[this._stack.length-1] === name){
		if(this._cbs.onclosetag){
			this._cbs.onclosetag(name);
		}
		this._stack.pop();
	}
};

Parser.prototype.onattribname = function(name){
	if(!(this._options.xmlMode || "lowerCaseAttributeNames" in this._options) || this._options.lowerCaseAttributeNames){
		name = name.toLowerCase();
	}
	this._attribname = name;
};

Parser.prototype.onattribdata = function(value){
	this._attribvalue += value;
};

Parser.prototype.onattribend = function(){
	if(this._cbs.onattribute) this._cbs.onattribute(this._attribname, this._attribvalue);
	if(
		this._attribs &&
		!Object.prototype.hasOwnProperty.call(this._attribs, this._attribname)
	){
		this._attribs[this._attribname] = this._attribvalue;
	}
	this._attribname = "";
	this._attribvalue = "";
};

Parser.prototype.ondeclaration = function(value){
	if(this._cbs.onprocessinginstruction){
		var idx = value.search(re_nameEnd),
		    name = idx < 0 ? value : value.substr(0, idx);

		if(!(this._options.xmlMode || "lowerCaseTags" in this._options) || this._options.lowerCaseTags){
			name = name.toLowerCase();
		}
		this._cbs.onprocessinginstruction("!" + name, "!" + value);
	}
};

Parser.prototype.onprocessinginstruction = function(value){
	if(this._cbs.onprocessinginstruction){
		var idx = value.search(re_nameEnd),
		    name = idx < 0 ? value : value.substr(0, idx);

		if(!(this._options.xmlMode || "lowerCaseTags" in this._options) || this._options.lowerCaseTags){
			name = name.toLowerCase();
		}
		this._cbs.onprocessinginstruction("?" + name, "?" + value);
	}
};

Parser.prototype.oncomment = function(value){
	this._updatePosition(4);

	if(this._cbs.oncomment) this._cbs.oncomment(value);
	if(this._cbs.oncommentend) this._cbs.oncommentend();
};

Parser.prototype.oncdata = function(value){
	this._updatePosition(1);

	if(this._options.xmlMode){
		if(this._cbs.oncdatastart) this._cbs.oncdatastart();
		if(this._cbs.ontext) this._cbs.ontext(value);
		if(this._cbs.oncdataend) this._cbs.oncdataend();
	} else {
		this.oncomment("[CDATA[" + value + "]]");
	}
};

Parser.prototype.onerror = function(err){
	if(this._cbs.onerror) this._cbs.onerror(err);
};

Parser.prototype.onend = function(){
	if(this._cbs.onclosetag){
		for(
			var i = this._stack.length;
			i > 0;
			this._cbs.onclosetag(this._stack[--i])
		);
	}
	if(this._cbs.onend) this._cbs.onend();
};


//Resets the parser to a blank state, ready to parse a new HTML document
Parser.prototype.reset = function(){
	if(this._cbs.onreset) this._cbs.onreset();
	this._tokenizer.reset();

	this._tagname = "";
	this._attribname = "";
	this._attribs = null;
	this._stack = [];
	this._done = false;
};

//Parses a complete HTML document and pushes it to the handler
Parser.prototype.parseComplete = function(data){
	this.reset();
	this.end(data);
};

Parser.prototype.write = function(chunk){
	if(this._done) this.onerror(Error(".write() after done!"));
	this._tokenizer.write(chunk);
};

Parser.prototype.end = function(chunk){
	if(this._done) this.onerror(Error(".end() after done!"));
	this._tokenizer.end(chunk);
	this._done = true;
};

//alias for backwards compat
Parser.prototype.parseChunk = Parser.prototype.write;
Parser.prototype.done = Parser.prototype.end;

module.exports = Parser;

},{"./Tokenizer.js":35,"events":47,"util":52}],34:[function(require,module,exports){
module.exports = ProxyHandler;

var ProxyHandler = function(cbs){
	this._cbs = cbs || {};
};

var EVENTS = require("./").EVENTS;
Object.keys(EVENTS).forEach(function(name){
	if(EVENTS[name] === 0){
		name = "on" + name;
		ProxyHandler.prototype[name] = function(){
			if(this._cbs[name]) this._cbs[name]();
		};
	} else if(EVENTS[name] === 1){
		name = "on" + name;
		ProxyHandler.prototype[name] = function(a){
			if(this._cbs[name]) this._cbs[name](a);
		};
	} else if(EVENTS[name] === 2){
		name = "on" + name;
		ProxyHandler.prototype[name] = function(a, b){
			if(this._cbs[name]) this._cbs[name](a, b);
		};
	} else {
		throw Error("wrong number of arguments");
	}
});
},{"./":40}],35:[function(require,module,exports){
module.exports = Tokenizer;

var entityMap = require("./entities/entities.json"),
    legacyMap = require("./entities/legacy.json"),
    xmlMap    = require("./entities/xml.json"),
    decodeMap = require("./entities/decode.json"),

    i = 0,

    TEXT                      = i++,
    BEFORE_TAG_NAME           = i++, //after <
    IN_TAG_NAME               = i++,
    IN_SELF_CLOSING_TAG       = i++,
    BEFORE_CLOSING_TAG_NAME   = i++,
    IN_CLOSING_TAG_NAME       = i++,
    AFTER_CLOSING_TAG_NAME    = i++,

    //attributes
    BEFORE_ATTRIBUTE_NAME     = i++,
    IN_ATTRIBUTE_NAME         = i++,
    AFTER_ATTRIBUTE_NAME      = i++,
    BEFORE_ATTRIBUTE_VALUE    = i++,
    IN_ATTRIBUTE_VALUE_DQ     = i++, // "
    IN_ATTRIBUTE_VALUE_SQ     = i++, // '
    IN_ATTRIBUTE_VALUE_NQ     = i++,

    //declarations
    BEFORE_DECLARATION        = i++, // !
    IN_DECLARATION            = i++,

    //processing instructions
    IN_PROCESSING_INSTRUCTION = i++, // ?

    //comments
    BEFORE_COMMENT            = i++,
    IN_COMMENT                = i++,
    AFTER_COMMENT_1           = i++,
    AFTER_COMMENT_2           = i++,

    //cdata
    BEFORE_CDATA_1            = i++, // [
    BEFORE_CDATA_2            = i++, // C
    BEFORE_CDATA_3            = i++, // D
    BEFORE_CDATA_4            = i++, // A
    BEFORE_CDATA_5            = i++, // T
    BEFORE_CDATA_6            = i++, // A
    IN_CDATA                  = i++,// [
    AFTER_CDATA_1             = i++, // ]
    AFTER_CDATA_2             = i++, // ]

    //special tags
    BEFORE_SPECIAL            = i++, //S
    BEFORE_SPECIAL_END        = i++,   //S

    BEFORE_SCRIPT_1           = i++, //C
    BEFORE_SCRIPT_2           = i++, //R
    BEFORE_SCRIPT_3           = i++, //I
    BEFORE_SCRIPT_4           = i++, //P
    BEFORE_SCRIPT_5           = i++, //T
    AFTER_SCRIPT_1            = i++, //C
    AFTER_SCRIPT_2            = i++, //R
    AFTER_SCRIPT_3            = i++, //I
    AFTER_SCRIPT_4            = i++, //P
    AFTER_SCRIPT_5            = i++, //T

    BEFORE_STYLE_1            = i++, //T
    BEFORE_STYLE_2            = i++, //Y
    BEFORE_STYLE_3            = i++, //L
    BEFORE_STYLE_4            = i++, //E
    AFTER_STYLE_1             = i++, //T
    AFTER_STYLE_2             = i++, //Y
    AFTER_STYLE_3             = i++, //L
    AFTER_STYLE_4             = i++, //E

    BEFORE_ENTITY             = i++, //&
    BEFORE_NUMERIC_ENTITY     = i++, //#
    IN_NAMED_ENTITY           = i++,
    IN_NUMERIC_ENTITY         = i++,
    IN_HEX_ENTITY             = i++, //X

    j = 0,

    SPECIAL_NONE              = j++,
    SPECIAL_SCRIPT            = j++,
    SPECIAL_STYLE             = j++;

function whitespace(c){
	return c === " " || c === "\n" || c === "\t" || c === "\f" || c === "\r";
}

function ifElseState(upper, SUCCESS, FAILURE){
	var lower = upper.toLowerCase();

	if(upper === lower){
		return function(c){
			this._state = c === lower ? SUCCESS : FAILURE;
		};
	} else {
		return function(c){
			this._state = (c === lower || c === upper) ? SUCCESS : FAILURE;
		};
	}
}

function consumeSpecialNameChar(upper, NEXT_STATE){
	var lower = upper.toLowerCase();

	return function(c){
		if(c === lower || c === upper){
			this._state = NEXT_STATE;
		} else {
			this._state = IN_TAG_NAME;
			this._index--; //consume the token again
		}
	};
}

function Tokenizer(options, cbs){
	this._state = TEXT;
	this._buffer = "";
	this._sectionStart = 0;
	this._index = 0;
	this._baseState = TEXT;
	this._special = SPECIAL_NONE;
	this._cbs = cbs;
	this._running = true;
	this._xmlMode = !!(options && options.xmlMode);
	this._decodeEntities = !!(options && options.decodeEntities);
}

Tokenizer.prototype._stateText = function(c){
	if(c === "<"){
		if(this._index > this._sectionStart){
			this._cbs.ontext(this._getSection());
		}
		this._state = BEFORE_TAG_NAME;
		this._sectionStart = this._index;
	} else if(this._decodeEntities && this._special === SPECIAL_NONE && c === "&"){
		if(this._index > this._sectionStart){
			this._cbs.ontext(this._getSection());
		}
		this._baseState = TEXT;
		this._state = BEFORE_ENTITY;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateBeforeTagName = function(c){
	if(c === "/"){
		this._state = BEFORE_CLOSING_TAG_NAME;
	} else if(c === ">" || this._special !== SPECIAL_NONE || whitespace(c)) {
		this._state = TEXT;
	} else if(c === "!"){
		this._state = BEFORE_DECLARATION;
		this._sectionStart = this._index + 1;
	} else if(c === "?"){
		this._state = IN_PROCESSING_INSTRUCTION;
		this._sectionStart = this._index + 1;
	} else if(c === "<"){
		this._cbs.ontext(this._getSection());
		this._sectionStart = this._index;
	} else {
		this._state = (!this._xmlMode && (c === "s" || c === "S")) ?
						BEFORE_SPECIAL : IN_TAG_NAME;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateInTagName = function(c){
	if(c === "/" || c === ">" || whitespace(c)){
		this._emitToken("onopentagname");
		this._state = BEFORE_ATTRIBUTE_NAME;
		this._index--;
	}
};

Tokenizer.prototype._stateBeforeCloseingTagName = function(c){
	if(whitespace(c));
	else if(c === ">"){
		this._state = TEXT;
	} else if(this._special !== SPECIAL_NONE){
		if(c === "s" || c === "S"){
			this._state = BEFORE_SPECIAL_END;
		} else {
			this._state = TEXT;
			this._index--;
		}
	} else {
		this._state = IN_CLOSING_TAG_NAME;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateInCloseingTagName = function(c){
	if(c === ">" || whitespace(c)){
		this._emitToken("onclosetag");
		this._state = AFTER_CLOSING_TAG_NAME;
		this._index--;
	}
};

Tokenizer.prototype._stateAfterCloseingTagName = function(c){
	//skip everything until ">"
	if(c === ">"){
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	}
};

Tokenizer.prototype._stateBeforeAttributeName = function(c){
	if(c === ">"){
		this._cbs.onopentagend();
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	} else if(c === "/"){
		this._state = IN_SELF_CLOSING_TAG;
	} else if(!whitespace(c)){
		this._state = IN_ATTRIBUTE_NAME;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateInSelfClosingTag = function(c){
	if(c === ">"){
		this._cbs.onselfclosingtag();
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	} else if(!whitespace(c)){
		this._state = BEFORE_ATTRIBUTE_NAME;
		this._index--;
	}
};

Tokenizer.prototype._stateInAttributeName = function(c){
	if(c === "=" || c === "/" || c === ">" || whitespace(c)){
		if(this._index > this._sectionStart){
			this._cbs.onattribname(this._getSection());
		}
		this._sectionStart = -1;
		this._state = AFTER_ATTRIBUTE_NAME;
		this._index--;
	}
};

Tokenizer.prototype._stateAfterAttributeName = function(c){
	if(c === "="){
		this._state = BEFORE_ATTRIBUTE_VALUE;
	} else if(c === "/" || c === ">"){
		this._cbs.onattribend();
		this._state = BEFORE_ATTRIBUTE_NAME;
		this._index--;
	} else if(!whitespace(c)){
		this._cbs.onattribend();
		this._state = IN_ATTRIBUTE_NAME;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateBeforeAttributeValue = function(c){
	if(c === "\""){
		this._state = IN_ATTRIBUTE_VALUE_DQ;
		this._sectionStart = this._index + 1;
	} else if(c === "'"){
		this._state = IN_ATTRIBUTE_VALUE_SQ;
		this._sectionStart = this._index + 1;
	} else if(!whitespace(c)){
		this._state = IN_ATTRIBUTE_VALUE_NQ;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateInAttributeValueDoubleQuotes = function(c){
	if(c === "\""){
		this._emitToken("onattribdata");
		this._cbs.onattribend();
		this._state = BEFORE_ATTRIBUTE_NAME;
	} else if(this._decodeEntities && c === "&"){
		this._emitToken("onattribdata");
		this._baseState = this._state;
		this._state = BEFORE_ENTITY;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateInAttributeValueSingleQuotes = function(c){
	if(c === "'"){
		this._emitToken("onattribdata");
		this._cbs.onattribend();
		this._state = BEFORE_ATTRIBUTE_NAME;
	} else if(this._decodeEntities && c === "&"){
		this._emitToken("onattribdata");
		this._baseState = this._state;
		this._state = BEFORE_ENTITY;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateInAttributeValueNoQuotes = function(c){
	if(whitespace(c) || c === ">"){
		this._emitToken("onattribdata");
		this._cbs.onattribend();
		this._state = BEFORE_ATTRIBUTE_NAME;
		this._index--;
	} else if(this._decodeEntities && c === "&"){
		this._emitToken("onattribdata");
		this._baseState = this._state;
		this._state = BEFORE_ENTITY;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateBeforeDeclaration = function(c){
	this._state = c === "[" ? BEFORE_CDATA_1 :
					c === "-" ? BEFORE_COMMENT :
						IN_DECLARATION;
};

Tokenizer.prototype._stateInDeclaration = function(c){
	if(c === ">"){
		this._cbs.ondeclaration(this._getSection());
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	}
};

Tokenizer.prototype._stateInProcessingInstruction = function(c){
	if(c === ">"){
		this._cbs.onprocessinginstruction(this._getSection());
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	}
};

Tokenizer.prototype._stateBeforeComment = function(c){
	if(c === "-"){
		this._state = IN_COMMENT;
		this._sectionStart = this._index + 1;
	} else {
		this._state = IN_DECLARATION;
	}
};

Tokenizer.prototype._stateInComment = function(c){
	if(c === "-") this._state = AFTER_COMMENT_1;
};

Tokenizer.prototype._stateAfterComment1 = ifElseState("-", AFTER_COMMENT_2, IN_COMMENT);

Tokenizer.prototype._stateAfterComment2 = function(c){
	if(c === ">"){
		//remove 2 trailing chars
		this._cbs.oncomment(this._buffer.substring(this._sectionStart, this._index - 2));
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	} else if(c !== "-"){
		this._state = IN_COMMENT;
	}
	// else: stay in AFTER_COMMENT_2 (`--->`)
};

Tokenizer.prototype._stateBeforeCdata1 = ifElseState("C", BEFORE_CDATA_2, IN_DECLARATION);
Tokenizer.prototype._stateBeforeCdata2 = ifElseState("D", BEFORE_CDATA_3, IN_DECLARATION);
Tokenizer.prototype._stateBeforeCdata3 = ifElseState("A", BEFORE_CDATA_4, IN_DECLARATION);
Tokenizer.prototype._stateBeforeCdata4 = ifElseState("T", BEFORE_CDATA_5, IN_DECLARATION);
Tokenizer.prototype._stateBeforeCdata5 = ifElseState("A", BEFORE_CDATA_6, IN_DECLARATION);

Tokenizer.prototype._stateBeforeCdata6 = function(c){
	if(c === "["){
		this._state = IN_CDATA;
		this._sectionStart = this._index + 1;
	} else {
		this._state = IN_DECLARATION;
	}
};

Tokenizer.prototype._stateInCdata = function(c){
	if(c === "]") this._state = AFTER_CDATA_1;
};

Tokenizer.prototype._stateAfterCdata1 = ifElseState("]", AFTER_CDATA_2, IN_CDATA);

Tokenizer.prototype._stateAfterCdata2 = function(c){
	if(c === ">"){
		//remove 2 trailing chars
		this._cbs.oncdata(this._buffer.substring(this._sectionStart, this._index - 2));
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	} else if (c !== "]") {
		this._state = IN_CDATA;
	}
	//else: stay in AFTER_CDATA_2 (`]]]>`)
};

Tokenizer.prototype._stateBeforeSpecial = function(c){
	if(c === "c" || c === "C"){
		this._state = BEFORE_SCRIPT_1;
	} else if(c === "t" || c === "T"){
		this._state = BEFORE_STYLE_1;
	} else {
		this._state = IN_TAG_NAME;
		this._index--; //consume the token again
	}
};

Tokenizer.prototype._stateBeforeSpecialEnd = function(c){
	if(this._special === SPECIAL_SCRIPT && (c === "c" || c === "C")){
		this._state = AFTER_SCRIPT_1;
	} else if(this._special === SPECIAL_STYLE && (c === "t" || c === "T")){
		this._state = AFTER_STYLE_1;
	}
	else this._state = TEXT;
};

Tokenizer.prototype._stateBeforeScript1 = consumeSpecialNameChar("R", BEFORE_SCRIPT_2);
Tokenizer.prototype._stateBeforeScript2 = consumeSpecialNameChar("I", BEFORE_SCRIPT_3);
Tokenizer.prototype._stateBeforeScript3 = consumeSpecialNameChar("P", BEFORE_SCRIPT_4);
Tokenizer.prototype._stateBeforeScript4 = consumeSpecialNameChar("T", BEFORE_SCRIPT_5);

Tokenizer.prototype._stateBeforeScript5 = function(c){
	if(c === "/" || c === ">" || whitespace(c)){
		this._special = SPECIAL_SCRIPT;
	}
	this._state = IN_TAG_NAME;
	this._index--; //consume the token again
};

Tokenizer.prototype._stateAfterScript1 = ifElseState("R", AFTER_SCRIPT_2, TEXT);
Tokenizer.prototype._stateAfterScript2 = ifElseState("I", AFTER_SCRIPT_3, TEXT);
Tokenizer.prototype._stateAfterScript3 = ifElseState("P", AFTER_SCRIPT_4, TEXT);
Tokenizer.prototype._stateAfterScript4 = ifElseState("T", AFTER_SCRIPT_5, TEXT);

Tokenizer.prototype._stateAfterScript5 = function(c){
	if(c === ">" || whitespace(c)){
		this._special = SPECIAL_NONE;
		this._state = IN_CLOSING_TAG_NAME;
		this._sectionStart = this._index - 6;
		this._index--; //reconsume the token
	}
	else this._state = TEXT;
};

Tokenizer.prototype._stateBeforeStyle1 = consumeSpecialNameChar("Y", BEFORE_STYLE_2);
Tokenizer.prototype._stateBeforeStyle2 = consumeSpecialNameChar("L", BEFORE_STYLE_3);
Tokenizer.prototype._stateBeforeStyle3 = consumeSpecialNameChar("E", BEFORE_STYLE_4);

Tokenizer.prototype._stateBeforeStyle4 = function(c){
	if(c === "/" || c === ">" || whitespace(c)){
		this._special = SPECIAL_STYLE;
	}
	this._state = IN_TAG_NAME;
	this._index--; //consume the token again
};

Tokenizer.prototype._stateAfterStyle1 = ifElseState("Y", AFTER_STYLE_2, TEXT);
Tokenizer.prototype._stateAfterStyle2 = ifElseState("L", AFTER_STYLE_3, TEXT);
Tokenizer.prototype._stateAfterStyle3 = ifElseState("E", AFTER_STYLE_4, TEXT);

Tokenizer.prototype._stateAfterStyle4 = function(c){
	if(c === ">" || whitespace(c)){
		this._special = SPECIAL_NONE;
		this._state = IN_CLOSING_TAG_NAME;
		this._sectionStart = this._index - 5;
		this._index--; //reconsume the token
	}
	else this._state = TEXT;
};

Tokenizer.prototype._stateBeforeEntity = ifElseState("#", BEFORE_NUMERIC_ENTITY, IN_NAMED_ENTITY);
Tokenizer.prototype._stateBeforeNumericEntity = ifElseState("X", IN_HEX_ENTITY, IN_NUMERIC_ENTITY);

//for entities within attributes
Tokenizer.prototype._parseNamedEntityStrict = function(){
	//offset = 1
	if(this._sectionStart + 1 < this._index){
		var entity = this._buffer.substring(this._sectionStart + 1, this._index),
		    map = this._xmlMode ? xmlMap : entityMap;

		if(map.hasOwnProperty(entity)){
			this._emitPartial(map[entity]);
			this._sectionStart = this._index + 1;
		}
	}
};


//parses legacy entities (without trailing semicolon)
Tokenizer.prototype._parseLegacyEntity = function(){
	var start = this._sectionStart + 1,
	    limit = this._index - start;

	if(limit > 6) limit = 6; //the max length of legacy entities is 6

	while(limit >= 2){ //the min length of legacy entities is 2
		var entity = this._buffer.substr(start, limit);

		if(legacyMap.hasOwnProperty(entity)){
			this._emitPartial(legacyMap[entity]);
			this._sectionStart += limit + 2;
			break;
		} else {
			limit--;
		}
	}
};

Tokenizer.prototype._stateInNamedEntity = function(c){
	if(c === ";"){
		this._parseNamedEntityStrict();
		if(this._sectionStart + 1 < this._index && !this._xmlMode){
			this._parseLegacyEntity();
		}
		this._state = this._baseState;
	} else if((c < "a" || c > "z") && (c < "A" || c > "Z") && (c < "0" || c > "9")){
		if(this._xmlMode);
		else if(this._baseState !== TEXT){
			if(c !== "="){
				this._parseNamedEntityStrict();
				this._sectionStart--; //include the current character in the section
			}
		} else {
			this._parseLegacyEntity();
			this._sectionStart--;
		}
		this._state = this._baseState;
		this._index--;
	}
};

// modified version of https://github.com/mathiasbynens/he/blob/master/src/he.js#L94-L119
function decodeCodePoint(codePoint){
	var output = "";

	if((codePoint >= 0xD800 && codePoint <= 0xDFFF) || codePoint > 0x10FFFF){
		return "\uFFFD";
	}

	if(codePoint in decodeMap){
		codePoint = decodeMap[codePoint];
	}

	if(codePoint > 0xFFFF){
		codePoint -= 0x10000;
		output += String.fromCharCode(codePoint >>> 10 & 0x3FF | 0xD800);
		codePoint = 0xDC00 | codePoint & 0x3FF;
	}

	output += String.fromCharCode(codePoint);
	return output;
}

Tokenizer.prototype._decodeNumericEntity = function(offset, base){
	var sectionStart = this._sectionStart + offset;

	if(sectionStart !== this._index){
		//parse entity
		var entity = this._buffer.substring(sectionStart, this._index);
		var parsed = parseInt(entity, base);

		if(parsed === parsed){ //not NaN (TODO: when can this happen?)
			this._emitPartial(decodeCodePoint(parsed));
			this._sectionStart = this._index;
		}
	}

	this._state = this._baseState;
};

Tokenizer.prototype._stateInNumericEntity = function(c){
	if(c === ";"){
		this._decodeNumericEntity(2, 10);
		this._sectionStart++;
	} else if(c < "0" || c > "9"){
		if(!this._xmlMode){
			this._decodeNumericEntity(2, 10);
		} else {
			this._state = this._baseState;
		}
		this._index--;
	}
};

Tokenizer.prototype._stateInHexEntity = function(c){
	if(c === ";"){
		this._decodeNumericEntity(3, 16);
		this._sectionStart++;
	} else if((c < "a" || c > "f") && (c < "A" || c > "F") && (c < "0" || c > "9")){
		if(!this._xmlMode){
			this._decodeNumericEntity(3, 16);
		} else {
			this._state = this._baseState;
		}
		this._index--;
	}
};

Tokenizer.prototype._cleanup = function () {
	if(this._sectionStart < 0){
		this._buffer = "";
		this._index = 0;
	} else {
		if(this._state === TEXT){
			if(this._sectionStart !== this._index){
				this._cbs.ontext(this._buffer.substr(this._sectionStart));
			}
			this._buffer = "";
			this._index = 0;
		} else if(this._sectionStart === this._index){
			//the section just started
			this._buffer = "";
			this._index = 0;
		} else {
			//remove everything unnecessary
			this._buffer = this._buffer.substr(this._sectionStart);
			this._index -= this._sectionStart;
		}

		this._sectionStart = 0;
	}
};

//TODO make events conditional
Tokenizer.prototype.write = function(chunk){
	this._buffer += chunk;

	while(this._index < this._buffer.length && this._running){
		var c = this._buffer.charAt(this._index);
		if(this._state === TEXT) {
			this._stateText(c);
		} else if(this._state === BEFORE_TAG_NAME){
			this._stateBeforeTagName(c);
		} else if(this._state === IN_TAG_NAME) {
			this._stateInTagName(c);
		} else if(this._state === BEFORE_CLOSING_TAG_NAME){
			this._stateBeforeCloseingTagName(c);
		} else if(this._state === IN_CLOSING_TAG_NAME){
			this._stateInCloseingTagName(c);
		} else if(this._state === AFTER_CLOSING_TAG_NAME){
			this._stateAfterCloseingTagName(c);
		} else if(this._state === IN_SELF_CLOSING_TAG){
			this._stateInSelfClosingTag(c);
		}

		/*
		*	attributes
		*/
		else if(this._state === BEFORE_ATTRIBUTE_NAME){
			this._stateBeforeAttributeName(c);
		} else if(this._state === IN_ATTRIBUTE_NAME){
			this._stateInAttributeName(c);
		} else if(this._state === AFTER_ATTRIBUTE_NAME){
			this._stateAfterAttributeName(c);
		} else if(this._state === BEFORE_ATTRIBUTE_VALUE){
			this._stateBeforeAttributeValue(c);
		} else if(this._state === IN_ATTRIBUTE_VALUE_DQ){
			this._stateInAttributeValueDoubleQuotes(c);
		} else if(this._state === IN_ATTRIBUTE_VALUE_SQ){
			this._stateInAttributeValueSingleQuotes(c);
		} else if(this._state === IN_ATTRIBUTE_VALUE_NQ){
			this._stateInAttributeValueNoQuotes(c);
		}

		/*
		*	declarations
		*/
		else if(this._state === BEFORE_DECLARATION){
			this._stateBeforeDeclaration(c);
		} else if(this._state === IN_DECLARATION){
			this._stateInDeclaration(c);
		}

		/*
		*	processing instructions
		*/
		else if(this._state === IN_PROCESSING_INSTRUCTION){
			this._stateInProcessingInstruction(c);
		}

		/*
		*	comments
		*/
		else if(this._state === BEFORE_COMMENT){
			this._stateBeforeComment(c);
		} else if(this._state === IN_COMMENT){
			this._stateInComment(c);
		} else if(this._state === AFTER_COMMENT_1){
			this._stateAfterComment1(c);
		} else if(this._state === AFTER_COMMENT_2){
			this._stateAfterComment2(c);
		}

		/*
		*	cdata
		*/
		else if(this._state === BEFORE_CDATA_1){
			this._stateBeforeCdata1(c);
		} else if(this._state === BEFORE_CDATA_2){
			this._stateBeforeCdata2(c);
		} else if(this._state === BEFORE_CDATA_3){
			this._stateBeforeCdata3(c);
		} else if(this._state === BEFORE_CDATA_4){
			this._stateBeforeCdata4(c);
		} else if(this._state === BEFORE_CDATA_5){
			this._stateBeforeCdata5(c);
		} else if(this._state === BEFORE_CDATA_6){
			this._stateBeforeCdata6(c);
		} else if(this._state === IN_CDATA){
			this._stateInCdata(c);
		} else if(this._state === AFTER_CDATA_1){
			this._stateAfterCdata1(c);
		} else if(this._state === AFTER_CDATA_2){
			this._stateAfterCdata2(c);
		}

		/*
		* special tags
		*/
		else if(this._state === BEFORE_SPECIAL){
			this._stateBeforeSpecial(c);
		} else if(this._state === BEFORE_SPECIAL_END){
			this._stateBeforeSpecialEnd(c);
		}

		/*
		* script
		*/
		else if(this._state === BEFORE_SCRIPT_1){
			this._stateBeforeScript1(c);
		} else if(this._state === BEFORE_SCRIPT_2){
			this._stateBeforeScript2(c);
		} else if(this._state === BEFORE_SCRIPT_3){
			this._stateBeforeScript3(c);
		} else if(this._state === BEFORE_SCRIPT_4){
			this._stateBeforeScript4(c);
		} else if(this._state === BEFORE_SCRIPT_5){
			this._stateBeforeScript5(c);
		}

		else if(this._state === AFTER_SCRIPT_1){
			this._stateAfterScript1(c);
		} else if(this._state === AFTER_SCRIPT_2){
			this._stateAfterScript2(c);
		} else if(this._state === AFTER_SCRIPT_3){
			this._stateAfterScript3(c);
		} else if(this._state === AFTER_SCRIPT_4){
			this._stateAfterScript4(c);
		} else if(this._state === AFTER_SCRIPT_5){
			this._stateAfterScript5(c);
		}

		/*
		* style
		*/
		else if(this._state === BEFORE_STYLE_1){
			this._stateBeforeStyle1(c);
		} else if(this._state === BEFORE_STYLE_2){
			this._stateBeforeStyle2(c);
		} else if(this._state === BEFORE_STYLE_3){
			this._stateBeforeStyle3(c);
		} else if(this._state === BEFORE_STYLE_4){
			this._stateBeforeStyle4(c);
		}

		else if(this._state === AFTER_STYLE_1){
			this._stateAfterStyle1(c);
		} else if(this._state === AFTER_STYLE_2){
			this._stateAfterStyle2(c);
		} else if(this._state === AFTER_STYLE_3){
			this._stateAfterStyle3(c);
		} else if(this._state === AFTER_STYLE_4){
			this._stateAfterStyle4(c);
		}

		/*
		* entities
		*/
		else if(this._state === BEFORE_ENTITY){
			this._stateBeforeEntity(c);
		} else if(this._state === BEFORE_NUMERIC_ENTITY){
			this._stateBeforeNumericEntity(c);
		} else if(this._state === IN_NAMED_ENTITY){
			this._stateInNamedEntity(c);
		} else if(this._state === IN_NUMERIC_ENTITY){
			this._stateInNumericEntity(c);
		} else if(this._state === IN_HEX_ENTITY){
			this._stateInHexEntity(c);
		}

		else {
			this._cbs.onerror(Error("unknown _state"), this._state);
		}

		this._index++;
	}

	this._cleanup();
};

Tokenizer.prototype.pause = function(){
	this._running = false;
};
Tokenizer.prototype.resume = function(){
	this._running = true;
};

Tokenizer.prototype.end = function(chunk){
	if(chunk) this.write(chunk);

	//if there is remaining data, emit it in a reasonable way
	if(this._sectionStart < this._index){
		this._handleTrailingData();
	}

	this._cbs.onend();
};

Tokenizer.prototype._handleTrailingData = function(){
	var data = this._buffer.substr(this._sectionStart);

	if(this._state === IN_CDATA || this._state === AFTER_CDATA_1 || this._state === AFTER_CDATA_2){
		this._cbs.oncdata(data);
	} else if(this._state === IN_COMMENT || this._state === AFTER_COMMENT_1 || this._state === AFTER_COMMENT_2){
		this._cbs.oncomment(data);
	} else if(this._state === IN_TAG_NAME){
		this._cbs.onopentagname(data);
	} else if(this._state === BEFORE_ATTRIBUTE_NAME || this._state === BEFORE_ATTRIBUTE_VALUE || this._state === AFTER_ATTRIBUTE_NAME){
		this._cbs.onopentagend();
	} else if(this._state === IN_ATTRIBUTE_NAME){
		this._cbs.onattribname(data);
	} else if(this._state === IN_ATTRIBUTE_VALUE_SQ || this._state === IN_ATTRIBUTE_VALUE_DQ || this._state === IN_ATTRIBUTE_VALUE_NQ){
		this._cbs.onattribdata(data);
		this._cbs.onattribend();
	} else if(this._state === IN_CLOSING_TAG_NAME){
		this._cbs.onclosetag(data);
	} else if(this._state === IN_NAMED_ENTITY && !this._xmlMode){
		this._parseLegacyEntity();
		if(--this._sectionStart < this._index){
			this._state = this._baseState;
			this._handleTrailingData();
		}
	} else if(this._state === IN_NUMERIC_ENTITY && !this._xmlMode){
		this._decodeNumericEntity(2, 10);
		if(this._sectionStart < this._index){
			this._state = this._baseState;
			this._handleTrailingData();
		}
	} else if(this._state === IN_HEX_ENTITY && !this._xmlMode){
		this._decodeNumericEntity(3, 16);
		if(this._sectionStart < this._index){
			this._state = this._baseState;
			this._handleTrailingData();
		}
	} else {
		this._cbs.ontext(data);
	}
};

Tokenizer.prototype.reset = function(){
	Tokenizer.call(this, {xmlMode: this._xmlMode, decodeEntities: this._decodeEntities}, this._cbs);
};

Tokenizer.prototype._getSection = function(){
	return this._buffer.substring(this._sectionStart, this._index);
};

Tokenizer.prototype._emitToken = function(name){
	this._cbs[name](this._getSection());
	this._sectionStart = -1;
};

Tokenizer.prototype._emitPartial = function(value){
	if(this._baseState !== TEXT){
		this._cbs.onattribdata(value); //TODO implement the new event
	} else {
		this._cbs.ontext(value);
	}
};

},{"./entities/decode.json":36,"./entities/entities.json":37,"./entities/legacy.json":38,"./entities/xml.json":39}],36:[function(require,module,exports){
module.exports={"0":"\uFFFD","128":"\u20AC","130":"\u201A","131":"\u0192","132":"\u201E","133":"\u2026","134":"\u2020","135":"\u2021","136":"\u02C6","137":"\u2030","138":"\u0160","139":"\u2039","140":"\u0152","142":"\u017D","145":"\u2018","146":"\u2019","147":"\u201C","148":"\u201D","149":"\u2022","150":"\u2013","151":"\u2014","152":"\u02DC","153":"\u2122","154":"\u0161","155":"\u203A","156":"\u0153","158":"\u017E","159":"\u0178"}

},{}],37:[function(require,module,exports){
module.exports={"Aacute":"\u00C1","aacute":"\u00E1","Abreve":"\u0102","abreve":"\u0103","ac":"\u223E","acd":"\u223F","acE":"\u223E\u0333","Acirc":"\u00C2","acirc":"\u00E2","acute":"\u00B4","Acy":"\u0410","acy":"\u0430","AElig":"\u00C6","aelig":"\u00E6","af":"\u2061","Afr":"\uD835\uDD04","afr":"\uD835\uDD1E","Agrave":"\u00C0","agrave":"\u00E0","alefsym":"\u2135","aleph":"\u2135","Alpha":"\u0391","alpha":"\u03B1","Amacr":"\u0100","amacr":"\u0101","amalg":"\u2A3F","amp":"&","AMP":"&","andand":"\u2A55","And":"\u2A53","and":"\u2227","andd":"\u2A5C","andslope":"\u2A58","andv":"\u2A5A","ang":"\u2220","ange":"\u29A4","angle":"\u2220","angmsdaa":"\u29A8","angmsdab":"\u29A9","angmsdac":"\u29AA","angmsdad":"\u29AB","angmsdae":"\u29AC","angmsdaf":"\u29AD","angmsdag":"\u29AE","angmsdah":"\u29AF","angmsd":"\u2221","angrt":"\u221F","angrtvb":"\u22BE","angrtvbd":"\u299D","angsph":"\u2222","angst":"\u00C5","angzarr":"\u237C","Aogon":"\u0104","aogon":"\u0105","Aopf":"\uD835\uDD38","aopf":"\uD835\uDD52","apacir":"\u2A6F","ap":"\u2248","apE":"\u2A70","ape":"\u224A","apid":"\u224B","apos":"'","ApplyFunction":"\u2061","approx":"\u2248","approxeq":"\u224A","Aring":"\u00C5","aring":"\u00E5","Ascr":"\uD835\uDC9C","ascr":"\uD835\uDCB6","Assign":"\u2254","ast":"*","asymp":"\u2248","asympeq":"\u224D","Atilde":"\u00C3","atilde":"\u00E3","Auml":"\u00C4","auml":"\u00E4","awconint":"\u2233","awint":"\u2A11","backcong":"\u224C","backepsilon":"\u03F6","backprime":"\u2035","backsim":"\u223D","backsimeq":"\u22CD","Backslash":"\u2216","Barv":"\u2AE7","barvee":"\u22BD","barwed":"\u2305","Barwed":"\u2306","barwedge":"\u2305","bbrk":"\u23B5","bbrktbrk":"\u23B6","bcong":"\u224C","Bcy":"\u0411","bcy":"\u0431","bdquo":"\u201E","becaus":"\u2235","because":"\u2235","Because":"\u2235","bemptyv":"\u29B0","bepsi":"\u03F6","bernou":"\u212C","Bernoullis":"\u212C","Beta":"\u0392","beta":"\u03B2","beth":"\u2136","between":"\u226C","Bfr":"\uD835\uDD05","bfr":"\uD835\uDD1F","bigcap":"\u22C2","bigcirc":"\u25EF","bigcup":"\u22C3","bigodot":"\u2A00","bigoplus":"\u2A01","bigotimes":"\u2A02","bigsqcup":"\u2A06","bigstar":"\u2605","bigtriangledown":"\u25BD","bigtriangleup":"\u25B3","biguplus":"\u2A04","bigvee":"\u22C1","bigwedge":"\u22C0","bkarow":"\u290D","blacklozenge":"\u29EB","blacksquare":"\u25AA","blacktriangle":"\u25B4","blacktriangledown":"\u25BE","blacktriangleleft":"\u25C2","blacktriangleright":"\u25B8","blank":"\u2423","blk12":"\u2592","blk14":"\u2591","blk34":"\u2593","block":"\u2588","bne":"=\u20E5","bnequiv":"\u2261\u20E5","bNot":"\u2AED","bnot":"\u2310","Bopf":"\uD835\uDD39","bopf":"\uD835\uDD53","bot":"\u22A5","bottom":"\u22A5","bowtie":"\u22C8","boxbox":"\u29C9","boxdl":"\u2510","boxdL":"\u2555","boxDl":"\u2556","boxDL":"\u2557","boxdr":"\u250C","boxdR":"\u2552","boxDr":"\u2553","boxDR":"\u2554","boxh":"\u2500","boxH":"\u2550","boxhd":"\u252C","boxHd":"\u2564","boxhD":"\u2565","boxHD":"\u2566","boxhu":"\u2534","boxHu":"\u2567","boxhU":"\u2568","boxHU":"\u2569","boxminus":"\u229F","boxplus":"\u229E","boxtimes":"\u22A0","boxul":"\u2518","boxuL":"\u255B","boxUl":"\u255C","boxUL":"\u255D","boxur":"\u2514","boxuR":"\u2558","boxUr":"\u2559","boxUR":"\u255A","boxv":"\u2502","boxV":"\u2551","boxvh":"\u253C","boxvH":"\u256A","boxVh":"\u256B","boxVH":"\u256C","boxvl":"\u2524","boxvL":"\u2561","boxVl":"\u2562","boxVL":"\u2563","boxvr":"\u251C","boxvR":"\u255E","boxVr":"\u255F","boxVR":"\u2560","bprime":"\u2035","breve":"\u02D8","Breve":"\u02D8","brvbar":"\u00A6","bscr":"\uD835\uDCB7","Bscr":"\u212C","bsemi":"\u204F","bsim":"\u223D","bsime":"\u22CD","bsolb":"\u29C5","bsol":"\\","bsolhsub":"\u27C8","bull":"\u2022","bullet":"\u2022","bump":"\u224E","bumpE":"\u2AAE","bumpe":"\u224F","Bumpeq":"\u224E","bumpeq":"\u224F","Cacute":"\u0106","cacute":"\u0107","capand":"\u2A44","capbrcup":"\u2A49","capcap":"\u2A4B","cap":"\u2229","Cap":"\u22D2","capcup":"\u2A47","capdot":"\u2A40","CapitalDifferentialD":"\u2145","caps":"\u2229\uFE00","caret":"\u2041","caron":"\u02C7","Cayleys":"\u212D","ccaps":"\u2A4D","Ccaron":"\u010C","ccaron":"\u010D","Ccedil":"\u00C7","ccedil":"\u00E7","Ccirc":"\u0108","ccirc":"\u0109","Cconint":"\u2230","ccups":"\u2A4C","ccupssm":"\u2A50","Cdot":"\u010A","cdot":"\u010B","cedil":"\u00B8","Cedilla":"\u00B8","cemptyv":"\u29B2","cent":"\u00A2","centerdot":"\u00B7","CenterDot":"\u00B7","cfr":"\uD835\uDD20","Cfr":"\u212D","CHcy":"\u0427","chcy":"\u0447","check":"\u2713","checkmark":"\u2713","Chi":"\u03A7","chi":"\u03C7","circ":"\u02C6","circeq":"\u2257","circlearrowleft":"\u21BA","circlearrowright":"\u21BB","circledast":"\u229B","circledcirc":"\u229A","circleddash":"\u229D","CircleDot":"\u2299","circledR":"\u00AE","circledS":"\u24C8","CircleMinus":"\u2296","CirclePlus":"\u2295","CircleTimes":"\u2297","cir":"\u25CB","cirE":"\u29C3","cire":"\u2257","cirfnint":"\u2A10","cirmid":"\u2AEF","cirscir":"\u29C2","ClockwiseContourIntegral":"\u2232","CloseCurlyDoubleQuote":"\u201D","CloseCurlyQuote":"\u2019","clubs":"\u2663","clubsuit":"\u2663","colon":":","Colon":"\u2237","Colone":"\u2A74","colone":"\u2254","coloneq":"\u2254","comma":",","commat":"@","comp":"\u2201","compfn":"\u2218","complement":"\u2201","complexes":"\u2102","cong":"\u2245","congdot":"\u2A6D","Congruent":"\u2261","conint":"\u222E","Conint":"\u222F","ContourIntegral":"\u222E","copf":"\uD835\uDD54","Copf":"\u2102","coprod":"\u2210","Coproduct":"\u2210","copy":"\u00A9","COPY":"\u00A9","copysr":"\u2117","CounterClockwiseContourIntegral":"\u2233","crarr":"\u21B5","cross":"\u2717","Cross":"\u2A2F","Cscr":"\uD835\uDC9E","cscr":"\uD835\uDCB8","csub":"\u2ACF","csube":"\u2AD1","csup":"\u2AD0","csupe":"\u2AD2","ctdot":"\u22EF","cudarrl":"\u2938","cudarrr":"\u2935","cuepr":"\u22DE","cuesc":"\u22DF","cularr":"\u21B6","cularrp":"\u293D","cupbrcap":"\u2A48","cupcap":"\u2A46","CupCap":"\u224D","cup":"\u222A","Cup":"\u22D3","cupcup":"\u2A4A","cupdot":"\u228D","cupor":"\u2A45","cups":"\u222A\uFE00","curarr":"\u21B7","curarrm":"\u293C","curlyeqprec":"\u22DE","curlyeqsucc":"\u22DF","curlyvee":"\u22CE","curlywedge":"\u22CF","curren":"\u00A4","curvearrowleft":"\u21B6","curvearrowright":"\u21B7","cuvee":"\u22CE","cuwed":"\u22CF","cwconint":"\u2232","cwint":"\u2231","cylcty":"\u232D","dagger":"\u2020","Dagger":"\u2021","daleth":"\u2138","darr":"\u2193","Darr":"\u21A1","dArr":"\u21D3","dash":"\u2010","Dashv":"\u2AE4","dashv":"\u22A3","dbkarow":"\u290F","dblac":"\u02DD","Dcaron":"\u010E","dcaron":"\u010F","Dcy":"\u0414","dcy":"\u0434","ddagger":"\u2021","ddarr":"\u21CA","DD":"\u2145","dd":"\u2146","DDotrahd":"\u2911","ddotseq":"\u2A77","deg":"\u00B0","Del":"\u2207","Delta":"\u0394","delta":"\u03B4","demptyv":"\u29B1","dfisht":"\u297F","Dfr":"\uD835\uDD07","dfr":"\uD835\uDD21","dHar":"\u2965","dharl":"\u21C3","dharr":"\u21C2","DiacriticalAcute":"\u00B4","DiacriticalDot":"\u02D9","DiacriticalDoubleAcute":"\u02DD","DiacriticalGrave":"`","DiacriticalTilde":"\u02DC","diam":"\u22C4","diamond":"\u22C4","Diamond":"\u22C4","diamondsuit":"\u2666","diams":"\u2666","die":"\u00A8","DifferentialD":"\u2146","digamma":"\u03DD","disin":"\u22F2","div":"\u00F7","divide":"\u00F7","divideontimes":"\u22C7","divonx":"\u22C7","DJcy":"\u0402","djcy":"\u0452","dlcorn":"\u231E","dlcrop":"\u230D","dollar":"$","Dopf":"\uD835\uDD3B","dopf":"\uD835\uDD55","Dot":"\u00A8","dot":"\u02D9","DotDot":"\u20DC","doteq":"\u2250","doteqdot":"\u2251","DotEqual":"\u2250","dotminus":"\u2238","dotplus":"\u2214","dotsquare":"\u22A1","doublebarwedge":"\u2306","DoubleContourIntegral":"\u222F","DoubleDot":"\u00A8","DoubleDownArrow":"\u21D3","DoubleLeftArrow":"\u21D0","DoubleLeftRightArrow":"\u21D4","DoubleLeftTee":"\u2AE4","DoubleLongLeftArrow":"\u27F8","DoubleLongLeftRightArrow":"\u27FA","DoubleLongRightArrow":"\u27F9","DoubleRightArrow":"\u21D2","DoubleRightTee":"\u22A8","DoubleUpArrow":"\u21D1","DoubleUpDownArrow":"\u21D5","DoubleVerticalBar":"\u2225","DownArrowBar":"\u2913","downarrow":"\u2193","DownArrow":"\u2193","Downarrow":"\u21D3","DownArrowUpArrow":"\u21F5","DownBreve":"\u0311","downdownarrows":"\u21CA","downharpoonleft":"\u21C3","downharpoonright":"\u21C2","DownLeftRightVector":"\u2950","DownLeftTeeVector":"\u295E","DownLeftVectorBar":"\u2956","DownLeftVector":"\u21BD","DownRightTeeVector":"\u295F","DownRightVectorBar":"\u2957","DownRightVector":"\u21C1","DownTeeArrow":"\u21A7","DownTee":"\u22A4","drbkarow":"\u2910","drcorn":"\u231F","drcrop":"\u230C","Dscr":"\uD835\uDC9F","dscr":"\uD835\uDCB9","DScy":"\u0405","dscy":"\u0455","dsol":"\u29F6","Dstrok":"\u0110","dstrok":"\u0111","dtdot":"\u22F1","dtri":"\u25BF","dtrif":"\u25BE","duarr":"\u21F5","duhar":"\u296F","dwangle":"\u29A6","DZcy":"\u040F","dzcy":"\u045F","dzigrarr":"\u27FF","Eacute":"\u00C9","eacute":"\u00E9","easter":"\u2A6E","Ecaron":"\u011A","ecaron":"\u011B","Ecirc":"\u00CA","ecirc":"\u00EA","ecir":"\u2256","ecolon":"\u2255","Ecy":"\u042D","ecy":"\u044D","eDDot":"\u2A77","Edot":"\u0116","edot":"\u0117","eDot":"\u2251","ee":"\u2147","efDot":"\u2252","Efr":"\uD835\uDD08","efr":"\uD835\uDD22","eg":"\u2A9A","Egrave":"\u00C8","egrave":"\u00E8","egs":"\u2A96","egsdot":"\u2A98","el":"\u2A99","Element":"\u2208","elinters":"\u23E7","ell":"\u2113","els":"\u2A95","elsdot":"\u2A97","Emacr":"\u0112","emacr":"\u0113","empty":"\u2205","emptyset":"\u2205","EmptySmallSquare":"\u25FB","emptyv":"\u2205","EmptyVerySmallSquare":"\u25AB","emsp13":"\u2004","emsp14":"\u2005","emsp":"\u2003","ENG":"\u014A","eng":"\u014B","ensp":"\u2002","Eogon":"\u0118","eogon":"\u0119","Eopf":"\uD835\uDD3C","eopf":"\uD835\uDD56","epar":"\u22D5","eparsl":"\u29E3","eplus":"\u2A71","epsi":"\u03B5","Epsilon":"\u0395","epsilon":"\u03B5","epsiv":"\u03F5","eqcirc":"\u2256","eqcolon":"\u2255","eqsim":"\u2242","eqslantgtr":"\u2A96","eqslantless":"\u2A95","Equal":"\u2A75","equals":"=","EqualTilde":"\u2242","equest":"\u225F","Equilibrium":"\u21CC","equiv":"\u2261","equivDD":"\u2A78","eqvparsl":"\u29E5","erarr":"\u2971","erDot":"\u2253","escr":"\u212F","Escr":"\u2130","esdot":"\u2250","Esim":"\u2A73","esim":"\u2242","Eta":"\u0397","eta":"\u03B7","ETH":"\u00D0","eth":"\u00F0","Euml":"\u00CB","euml":"\u00EB","euro":"\u20AC","excl":"!","exist":"\u2203","Exists":"\u2203","expectation":"\u2130","exponentiale":"\u2147","ExponentialE":"\u2147","fallingdotseq":"\u2252","Fcy":"\u0424","fcy":"\u0444","female":"\u2640","ffilig":"\uFB03","fflig":"\uFB00","ffllig":"\uFB04","Ffr":"\uD835\uDD09","ffr":"\uD835\uDD23","filig":"\uFB01","FilledSmallSquare":"\u25FC","FilledVerySmallSquare":"\u25AA","fjlig":"fj","flat":"\u266D","fllig":"\uFB02","fltns":"\u25B1","fnof":"\u0192","Fopf":"\uD835\uDD3D","fopf":"\uD835\uDD57","forall":"\u2200","ForAll":"\u2200","fork":"\u22D4","forkv":"\u2AD9","Fouriertrf":"\u2131","fpartint":"\u2A0D","frac12":"\u00BD","frac13":"\u2153","frac14":"\u00BC","frac15":"\u2155","frac16":"\u2159","frac18":"\u215B","frac23":"\u2154","frac25":"\u2156","frac34":"\u00BE","frac35":"\u2157","frac38":"\u215C","frac45":"\u2158","frac56":"\u215A","frac58":"\u215D","frac78":"\u215E","frasl":"\u2044","frown":"\u2322","fscr":"\uD835\uDCBB","Fscr":"\u2131","gacute":"\u01F5","Gamma":"\u0393","gamma":"\u03B3","Gammad":"\u03DC","gammad":"\u03DD","gap":"\u2A86","Gbreve":"\u011E","gbreve":"\u011F","Gcedil":"\u0122","Gcirc":"\u011C","gcirc":"\u011D","Gcy":"\u0413","gcy":"\u0433","Gdot":"\u0120","gdot":"\u0121","ge":"\u2265","gE":"\u2267","gEl":"\u2A8C","gel":"\u22DB","geq":"\u2265","geqq":"\u2267","geqslant":"\u2A7E","gescc":"\u2AA9","ges":"\u2A7E","gesdot":"\u2A80","gesdoto":"\u2A82","gesdotol":"\u2A84","gesl":"\u22DB\uFE00","gesles":"\u2A94","Gfr":"\uD835\uDD0A","gfr":"\uD835\uDD24","gg":"\u226B","Gg":"\u22D9","ggg":"\u22D9","gimel":"\u2137","GJcy":"\u0403","gjcy":"\u0453","gla":"\u2AA5","gl":"\u2277","glE":"\u2A92","glj":"\u2AA4","gnap":"\u2A8A","gnapprox":"\u2A8A","gne":"\u2A88","gnE":"\u2269","gneq":"\u2A88","gneqq":"\u2269","gnsim":"\u22E7","Gopf":"\uD835\uDD3E","gopf":"\uD835\uDD58","grave":"`","GreaterEqual":"\u2265","GreaterEqualLess":"\u22DB","GreaterFullEqual":"\u2267","GreaterGreater":"\u2AA2","GreaterLess":"\u2277","GreaterSlantEqual":"\u2A7E","GreaterTilde":"\u2273","Gscr":"\uD835\uDCA2","gscr":"\u210A","gsim":"\u2273","gsime":"\u2A8E","gsiml":"\u2A90","gtcc":"\u2AA7","gtcir":"\u2A7A","gt":">","GT":">","Gt":"\u226B","gtdot":"\u22D7","gtlPar":"\u2995","gtquest":"\u2A7C","gtrapprox":"\u2A86","gtrarr":"\u2978","gtrdot":"\u22D7","gtreqless":"\u22DB","gtreqqless":"\u2A8C","gtrless":"\u2277","gtrsim":"\u2273","gvertneqq":"\u2269\uFE00","gvnE":"\u2269\uFE00","Hacek":"\u02C7","hairsp":"\u200A","half":"\u00BD","hamilt":"\u210B","HARDcy":"\u042A","hardcy":"\u044A","harrcir":"\u2948","harr":"\u2194","hArr":"\u21D4","harrw":"\u21AD","Hat":"^","hbar":"\u210F","Hcirc":"\u0124","hcirc":"\u0125","hearts":"\u2665","heartsuit":"\u2665","hellip":"\u2026","hercon":"\u22B9","hfr":"\uD835\uDD25","Hfr":"\u210C","HilbertSpace":"\u210B","hksearow":"\u2925","hkswarow":"\u2926","hoarr":"\u21FF","homtht":"\u223B","hookleftarrow":"\u21A9","hookrightarrow":"\u21AA","hopf":"\uD835\uDD59","Hopf":"\u210D","horbar":"\u2015","HorizontalLine":"\u2500","hscr":"\uD835\uDCBD","Hscr":"\u210B","hslash":"\u210F","Hstrok":"\u0126","hstrok":"\u0127","HumpDownHump":"\u224E","HumpEqual":"\u224F","hybull":"\u2043","hyphen":"\u2010","Iacute":"\u00CD","iacute":"\u00ED","ic":"\u2063","Icirc":"\u00CE","icirc":"\u00EE","Icy":"\u0418","icy":"\u0438","Idot":"\u0130","IEcy":"\u0415","iecy":"\u0435","iexcl":"\u00A1","iff":"\u21D4","ifr":"\uD835\uDD26","Ifr":"\u2111","Igrave":"\u00CC","igrave":"\u00EC","ii":"\u2148","iiiint":"\u2A0C","iiint":"\u222D","iinfin":"\u29DC","iiota":"\u2129","IJlig":"\u0132","ijlig":"\u0133","Imacr":"\u012A","imacr":"\u012B","image":"\u2111","ImaginaryI":"\u2148","imagline":"\u2110","imagpart":"\u2111","imath":"\u0131","Im":"\u2111","imof":"\u22B7","imped":"\u01B5","Implies":"\u21D2","incare":"\u2105","in":"\u2208","infin":"\u221E","infintie":"\u29DD","inodot":"\u0131","intcal":"\u22BA","int":"\u222B","Int":"\u222C","integers":"\u2124","Integral":"\u222B","intercal":"\u22BA","Intersection":"\u22C2","intlarhk":"\u2A17","intprod":"\u2A3C","InvisibleComma":"\u2063","InvisibleTimes":"\u2062","IOcy":"\u0401","iocy":"\u0451","Iogon":"\u012E","iogon":"\u012F","Iopf":"\uD835\uDD40","iopf":"\uD835\uDD5A","Iota":"\u0399","iota":"\u03B9","iprod":"\u2A3C","iquest":"\u00BF","iscr":"\uD835\uDCBE","Iscr":"\u2110","isin":"\u2208","isindot":"\u22F5","isinE":"\u22F9","isins":"\u22F4","isinsv":"\u22F3","isinv":"\u2208","it":"\u2062","Itilde":"\u0128","itilde":"\u0129","Iukcy":"\u0406","iukcy":"\u0456","Iuml":"\u00CF","iuml":"\u00EF","Jcirc":"\u0134","jcirc":"\u0135","Jcy":"\u0419","jcy":"\u0439","Jfr":"\uD835\uDD0D","jfr":"\uD835\uDD27","jmath":"\u0237","Jopf":"\uD835\uDD41","jopf":"\uD835\uDD5B","Jscr":"\uD835\uDCA5","jscr":"\uD835\uDCBF","Jsercy":"\u0408","jsercy":"\u0458","Jukcy":"\u0404","jukcy":"\u0454","Kappa":"\u039A","kappa":"\u03BA","kappav":"\u03F0","Kcedil":"\u0136","kcedil":"\u0137","Kcy":"\u041A","kcy":"\u043A","Kfr":"\uD835\uDD0E","kfr":"\uD835\uDD28","kgreen":"\u0138","KHcy":"\u0425","khcy":"\u0445","KJcy":"\u040C","kjcy":"\u045C","Kopf":"\uD835\uDD42","kopf":"\uD835\uDD5C","Kscr":"\uD835\uDCA6","kscr":"\uD835\uDCC0","lAarr":"\u21DA","Lacute":"\u0139","lacute":"\u013A","laemptyv":"\u29B4","lagran":"\u2112","Lambda":"\u039B","lambda":"\u03BB","lang":"\u27E8","Lang":"\u27EA","langd":"\u2991","langle":"\u27E8","lap":"\u2A85","Laplacetrf":"\u2112","laquo":"\u00AB","larrb":"\u21E4","larrbfs":"\u291F","larr":"\u2190","Larr":"\u219E","lArr":"\u21D0","larrfs":"\u291D","larrhk":"\u21A9","larrlp":"\u21AB","larrpl":"\u2939","larrsim":"\u2973","larrtl":"\u21A2","latail":"\u2919","lAtail":"\u291B","lat":"\u2AAB","late":"\u2AAD","lates":"\u2AAD\uFE00","lbarr":"\u290C","lBarr":"\u290E","lbbrk":"\u2772","lbrace":"{","lbrack":"[","lbrke":"\u298B","lbrksld":"\u298F","lbrkslu":"\u298D","Lcaron":"\u013D","lcaron":"\u013E","Lcedil":"\u013B","lcedil":"\u013C","lceil":"\u2308","lcub":"{","Lcy":"\u041B","lcy":"\u043B","ldca":"\u2936","ldquo":"\u201C","ldquor":"\u201E","ldrdhar":"\u2967","ldrushar":"\u294B","ldsh":"\u21B2","le":"\u2264","lE":"\u2266","LeftAngleBracket":"\u27E8","LeftArrowBar":"\u21E4","leftarrow":"\u2190","LeftArrow":"\u2190","Leftarrow":"\u21D0","LeftArrowRightArrow":"\u21C6","leftarrowtail":"\u21A2","LeftCeiling":"\u2308","LeftDoubleBracket":"\u27E6","LeftDownTeeVector":"\u2961","LeftDownVectorBar":"\u2959","LeftDownVector":"\u21C3","LeftFloor":"\u230A","leftharpoondown":"\u21BD","leftharpoonup":"\u21BC","leftleftarrows":"\u21C7","leftrightarrow":"\u2194","LeftRightArrow":"\u2194","Leftrightarrow":"\u21D4","leftrightarrows":"\u21C6","leftrightharpoons":"\u21CB","leftrightsquigarrow":"\u21AD","LeftRightVector":"\u294E","LeftTeeArrow":"\u21A4","LeftTee":"\u22A3","LeftTeeVector":"\u295A","leftthreetimes":"\u22CB","LeftTriangleBar":"\u29CF","LeftTriangle":"\u22B2","LeftTriangleEqual":"\u22B4","LeftUpDownVector":"\u2951","LeftUpTeeVector":"\u2960","LeftUpVectorBar":"\u2958","LeftUpVector":"\u21BF","LeftVectorBar":"\u2952","LeftVector":"\u21BC","lEg":"\u2A8B","leg":"\u22DA","leq":"\u2264","leqq":"\u2266","leqslant":"\u2A7D","lescc":"\u2AA8","les":"\u2A7D","lesdot":"\u2A7F","lesdoto":"\u2A81","lesdotor":"\u2A83","lesg":"\u22DA\uFE00","lesges":"\u2A93","lessapprox":"\u2A85","lessdot":"\u22D6","lesseqgtr":"\u22DA","lesseqqgtr":"\u2A8B","LessEqualGreater":"\u22DA","LessFullEqual":"\u2266","LessGreater":"\u2276","lessgtr":"\u2276","LessLess":"\u2AA1","lesssim":"\u2272","LessSlantEqual":"\u2A7D","LessTilde":"\u2272","lfisht":"\u297C","lfloor":"\u230A","Lfr":"\uD835\uDD0F","lfr":"\uD835\uDD29","lg":"\u2276","lgE":"\u2A91","lHar":"\u2962","lhard":"\u21BD","lharu":"\u21BC","lharul":"\u296A","lhblk":"\u2584","LJcy":"\u0409","ljcy":"\u0459","llarr":"\u21C7","ll":"\u226A","Ll":"\u22D8","llcorner":"\u231E","Lleftarrow":"\u21DA","llhard":"\u296B","lltri":"\u25FA","Lmidot":"\u013F","lmidot":"\u0140","lmoustache":"\u23B0","lmoust":"\u23B0","lnap":"\u2A89","lnapprox":"\u2A89","lne":"\u2A87","lnE":"\u2268","lneq":"\u2A87","lneqq":"\u2268","lnsim":"\u22E6","loang":"\u27EC","loarr":"\u21FD","lobrk":"\u27E6","longleftarrow":"\u27F5","LongLeftArrow":"\u27F5","Longleftarrow":"\u27F8","longleftrightarrow":"\u27F7","LongLeftRightArrow":"\u27F7","Longleftrightarrow":"\u27FA","longmapsto":"\u27FC","longrightarrow":"\u27F6","LongRightArrow":"\u27F6","Longrightarrow":"\u27F9","looparrowleft":"\u21AB","looparrowright":"\u21AC","lopar":"\u2985","Lopf":"\uD835\uDD43","lopf":"\uD835\uDD5D","loplus":"\u2A2D","lotimes":"\u2A34","lowast":"\u2217","lowbar":"_","LowerLeftArrow":"\u2199","LowerRightArrow":"\u2198","loz":"\u25CA","lozenge":"\u25CA","lozf":"\u29EB","lpar":"(","lparlt":"\u2993","lrarr":"\u21C6","lrcorner":"\u231F","lrhar":"\u21CB","lrhard":"\u296D","lrm":"\u200E","lrtri":"\u22BF","lsaquo":"\u2039","lscr":"\uD835\uDCC1","Lscr":"\u2112","lsh":"\u21B0","Lsh":"\u21B0","lsim":"\u2272","lsime":"\u2A8D","lsimg":"\u2A8F","lsqb":"[","lsquo":"\u2018","lsquor":"\u201A","Lstrok":"\u0141","lstrok":"\u0142","ltcc":"\u2AA6","ltcir":"\u2A79","lt":"<","LT":"<","Lt":"\u226A","ltdot":"\u22D6","lthree":"\u22CB","ltimes":"\u22C9","ltlarr":"\u2976","ltquest":"\u2A7B","ltri":"\u25C3","ltrie":"\u22B4","ltrif":"\u25C2","ltrPar":"\u2996","lurdshar":"\u294A","luruhar":"\u2966","lvertneqq":"\u2268\uFE00","lvnE":"\u2268\uFE00","macr":"\u00AF","male":"\u2642","malt":"\u2720","maltese":"\u2720","Map":"\u2905","map":"\u21A6","mapsto":"\u21A6","mapstodown":"\u21A7","mapstoleft":"\u21A4","mapstoup":"\u21A5","marker":"\u25AE","mcomma":"\u2A29","Mcy":"\u041C","mcy":"\u043C","mdash":"\u2014","mDDot":"\u223A","measuredangle":"\u2221","MediumSpace":"\u205F","Mellintrf":"\u2133","Mfr":"\uD835\uDD10","mfr":"\uD835\uDD2A","mho":"\u2127","micro":"\u00B5","midast":"*","midcir":"\u2AF0","mid":"\u2223","middot":"\u00B7","minusb":"\u229F","minus":"\u2212","minusd":"\u2238","minusdu":"\u2A2A","MinusPlus":"\u2213","mlcp":"\u2ADB","mldr":"\u2026","mnplus":"\u2213","models":"\u22A7","Mopf":"\uD835\uDD44","mopf":"\uD835\uDD5E","mp":"\u2213","mscr":"\uD835\uDCC2","Mscr":"\u2133","mstpos":"\u223E","Mu":"\u039C","mu":"\u03BC","multimap":"\u22B8","mumap":"\u22B8","nabla":"\u2207","Nacute":"\u0143","nacute":"\u0144","nang":"\u2220\u20D2","nap":"\u2249","napE":"\u2A70\u0338","napid":"\u224B\u0338","napos":"\u0149","napprox":"\u2249","natural":"\u266E","naturals":"\u2115","natur":"\u266E","nbsp":"\u00A0","nbump":"\u224E\u0338","nbumpe":"\u224F\u0338","ncap":"\u2A43","Ncaron":"\u0147","ncaron":"\u0148","Ncedil":"\u0145","ncedil":"\u0146","ncong":"\u2247","ncongdot":"\u2A6D\u0338","ncup":"\u2A42","Ncy":"\u041D","ncy":"\u043D","ndash":"\u2013","nearhk":"\u2924","nearr":"\u2197","neArr":"\u21D7","nearrow":"\u2197","ne":"\u2260","nedot":"\u2250\u0338","NegativeMediumSpace":"\u200B","NegativeThickSpace":"\u200B","NegativeThinSpace":"\u200B","NegativeVeryThinSpace":"\u200B","nequiv":"\u2262","nesear":"\u2928","nesim":"\u2242\u0338","NestedGreaterGreater":"\u226B","NestedLessLess":"\u226A","NewLine":"\n","nexist":"\u2204","nexists":"\u2204","Nfr":"\uD835\uDD11","nfr":"\uD835\uDD2B","ngE":"\u2267\u0338","nge":"\u2271","ngeq":"\u2271","ngeqq":"\u2267\u0338","ngeqslant":"\u2A7E\u0338","nges":"\u2A7E\u0338","nGg":"\u22D9\u0338","ngsim":"\u2275","nGt":"\u226B\u20D2","ngt":"\u226F","ngtr":"\u226F","nGtv":"\u226B\u0338","nharr":"\u21AE","nhArr":"\u21CE","nhpar":"\u2AF2","ni":"\u220B","nis":"\u22FC","nisd":"\u22FA","niv":"\u220B","NJcy":"\u040A","njcy":"\u045A","nlarr":"\u219A","nlArr":"\u21CD","nldr":"\u2025","nlE":"\u2266\u0338","nle":"\u2270","nleftarrow":"\u219A","nLeftarrow":"\u21CD","nleftrightarrow":"\u21AE","nLeftrightarrow":"\u21CE","nleq":"\u2270","nleqq":"\u2266\u0338","nleqslant":"\u2A7D\u0338","nles":"\u2A7D\u0338","nless":"\u226E","nLl":"\u22D8\u0338","nlsim":"\u2274","nLt":"\u226A\u20D2","nlt":"\u226E","nltri":"\u22EA","nltrie":"\u22EC","nLtv":"\u226A\u0338","nmid":"\u2224","NoBreak":"\u2060","NonBreakingSpace":"\u00A0","nopf":"\uD835\uDD5F","Nopf":"\u2115","Not":"\u2AEC","not":"\u00AC","NotCongruent":"\u2262","NotCupCap":"\u226D","NotDoubleVerticalBar":"\u2226","NotElement":"\u2209","NotEqual":"\u2260","NotEqualTilde":"\u2242\u0338","NotExists":"\u2204","NotGreater":"\u226F","NotGreaterEqual":"\u2271","NotGreaterFullEqual":"\u2267\u0338","NotGreaterGreater":"\u226B\u0338","NotGreaterLess":"\u2279","NotGreaterSlantEqual":"\u2A7E\u0338","NotGreaterTilde":"\u2275","NotHumpDownHump":"\u224E\u0338","NotHumpEqual":"\u224F\u0338","notin":"\u2209","notindot":"\u22F5\u0338","notinE":"\u22F9\u0338","notinva":"\u2209","notinvb":"\u22F7","notinvc":"\u22F6","NotLeftTriangleBar":"\u29CF\u0338","NotLeftTriangle":"\u22EA","NotLeftTriangleEqual":"\u22EC","NotLess":"\u226E","NotLessEqual":"\u2270","NotLessGreater":"\u2278","NotLessLess":"\u226A\u0338","NotLessSlantEqual":"\u2A7D\u0338","NotLessTilde":"\u2274","NotNestedGreaterGreater":"\u2AA2\u0338","NotNestedLessLess":"\u2AA1\u0338","notni":"\u220C","notniva":"\u220C","notnivb":"\u22FE","notnivc":"\u22FD","NotPrecedes":"\u2280","NotPrecedesEqual":"\u2AAF\u0338","NotPrecedesSlantEqual":"\u22E0","NotReverseElement":"\u220C","NotRightTriangleBar":"\u29D0\u0338","NotRightTriangle":"\u22EB","NotRightTriangleEqual":"\u22ED","NotSquareSubset":"\u228F\u0338","NotSquareSubsetEqual":"\u22E2","NotSquareSuperset":"\u2290\u0338","NotSquareSupersetEqual":"\u22E3","NotSubset":"\u2282\u20D2","NotSubsetEqual":"\u2288","NotSucceeds":"\u2281","NotSucceedsEqual":"\u2AB0\u0338","NotSucceedsSlantEqual":"\u22E1","NotSucceedsTilde":"\u227F\u0338","NotSuperset":"\u2283\u20D2","NotSupersetEqual":"\u2289","NotTilde":"\u2241","NotTildeEqual":"\u2244","NotTildeFullEqual":"\u2247","NotTildeTilde":"\u2249","NotVerticalBar":"\u2224","nparallel":"\u2226","npar":"\u2226","nparsl":"\u2AFD\u20E5","npart":"\u2202\u0338","npolint":"\u2A14","npr":"\u2280","nprcue":"\u22E0","nprec":"\u2280","npreceq":"\u2AAF\u0338","npre":"\u2AAF\u0338","nrarrc":"\u2933\u0338","nrarr":"\u219B","nrArr":"\u21CF","nrarrw":"\u219D\u0338","nrightarrow":"\u219B","nRightarrow":"\u21CF","nrtri":"\u22EB","nrtrie":"\u22ED","nsc":"\u2281","nsccue":"\u22E1","nsce":"\u2AB0\u0338","Nscr":"\uD835\uDCA9","nscr":"\uD835\uDCC3","nshortmid":"\u2224","nshortparallel":"\u2226","nsim":"\u2241","nsime":"\u2244","nsimeq":"\u2244","nsmid":"\u2224","nspar":"\u2226","nsqsube":"\u22E2","nsqsupe":"\u22E3","nsub":"\u2284","nsubE":"\u2AC5\u0338","nsube":"\u2288","nsubset":"\u2282\u20D2","nsubseteq":"\u2288","nsubseteqq":"\u2AC5\u0338","nsucc":"\u2281","nsucceq":"\u2AB0\u0338","nsup":"\u2285","nsupE":"\u2AC6\u0338","nsupe":"\u2289","nsupset":"\u2283\u20D2","nsupseteq":"\u2289","nsupseteqq":"\u2AC6\u0338","ntgl":"\u2279","Ntilde":"\u00D1","ntilde":"\u00F1","ntlg":"\u2278","ntriangleleft":"\u22EA","ntrianglelefteq":"\u22EC","ntriangleright":"\u22EB","ntrianglerighteq":"\u22ED","Nu":"\u039D","nu":"\u03BD","num":"#","numero":"\u2116","numsp":"\u2007","nvap":"\u224D\u20D2","nvdash":"\u22AC","nvDash":"\u22AD","nVdash":"\u22AE","nVDash":"\u22AF","nvge":"\u2265\u20D2","nvgt":">\u20D2","nvHarr":"\u2904","nvinfin":"\u29DE","nvlArr":"\u2902","nvle":"\u2264\u20D2","nvlt":"<\u20D2","nvltrie":"\u22B4\u20D2","nvrArr":"\u2903","nvrtrie":"\u22B5\u20D2","nvsim":"\u223C\u20D2","nwarhk":"\u2923","nwarr":"\u2196","nwArr":"\u21D6","nwarrow":"\u2196","nwnear":"\u2927","Oacute":"\u00D3","oacute":"\u00F3","oast":"\u229B","Ocirc":"\u00D4","ocirc":"\u00F4","ocir":"\u229A","Ocy":"\u041E","ocy":"\u043E","odash":"\u229D","Odblac":"\u0150","odblac":"\u0151","odiv":"\u2A38","odot":"\u2299","odsold":"\u29BC","OElig":"\u0152","oelig":"\u0153","ofcir":"\u29BF","Ofr":"\uD835\uDD12","ofr":"\uD835\uDD2C","ogon":"\u02DB","Ograve":"\u00D2","ograve":"\u00F2","ogt":"\u29C1","ohbar":"\u29B5","ohm":"\u03A9","oint":"\u222E","olarr":"\u21BA","olcir":"\u29BE","olcross":"\u29BB","oline":"\u203E","olt":"\u29C0","Omacr":"\u014C","omacr":"\u014D","Omega":"\u03A9","omega":"\u03C9","Omicron":"\u039F","omicron":"\u03BF","omid":"\u29B6","ominus":"\u2296","Oopf":"\uD835\uDD46","oopf":"\uD835\uDD60","opar":"\u29B7","OpenCurlyDoubleQuote":"\u201C","OpenCurlyQuote":"\u2018","operp":"\u29B9","oplus":"\u2295","orarr":"\u21BB","Or":"\u2A54","or":"\u2228","ord":"\u2A5D","order":"\u2134","orderof":"\u2134","ordf":"\u00AA","ordm":"\u00BA","origof":"\u22B6","oror":"\u2A56","orslope":"\u2A57","orv":"\u2A5B","oS":"\u24C8","Oscr":"\uD835\uDCAA","oscr":"\u2134","Oslash":"\u00D8","oslash":"\u00F8","osol":"\u2298","Otilde":"\u00D5","otilde":"\u00F5","otimesas":"\u2A36","Otimes":"\u2A37","otimes":"\u2297","Ouml":"\u00D6","ouml":"\u00F6","ovbar":"\u233D","OverBar":"\u203E","OverBrace":"\u23DE","OverBracket":"\u23B4","OverParenthesis":"\u23DC","para":"\u00B6","parallel":"\u2225","par":"\u2225","parsim":"\u2AF3","parsl":"\u2AFD","part":"\u2202","PartialD":"\u2202","Pcy":"\u041F","pcy":"\u043F","percnt":"%","period":".","permil":"\u2030","perp":"\u22A5","pertenk":"\u2031","Pfr":"\uD835\uDD13","pfr":"\uD835\uDD2D","Phi":"\u03A6","phi":"\u03C6","phiv":"\u03D5","phmmat":"\u2133","phone":"\u260E","Pi":"\u03A0","pi":"\u03C0","pitchfork":"\u22D4","piv":"\u03D6","planck":"\u210F","planckh":"\u210E","plankv":"\u210F","plusacir":"\u2A23","plusb":"\u229E","pluscir":"\u2A22","plus":"+","plusdo":"\u2214","plusdu":"\u2A25","pluse":"\u2A72","PlusMinus":"\u00B1","plusmn":"\u00B1","plussim":"\u2A26","plustwo":"\u2A27","pm":"\u00B1","Poincareplane":"\u210C","pointint":"\u2A15","popf":"\uD835\uDD61","Popf":"\u2119","pound":"\u00A3","prap":"\u2AB7","Pr":"\u2ABB","pr":"\u227A","prcue":"\u227C","precapprox":"\u2AB7","prec":"\u227A","preccurlyeq":"\u227C","Precedes":"\u227A","PrecedesEqual":"\u2AAF","PrecedesSlantEqual":"\u227C","PrecedesTilde":"\u227E","preceq":"\u2AAF","precnapprox":"\u2AB9","precneqq":"\u2AB5","precnsim":"\u22E8","pre":"\u2AAF","prE":"\u2AB3","precsim":"\u227E","prime":"\u2032","Prime":"\u2033","primes":"\u2119","prnap":"\u2AB9","prnE":"\u2AB5","prnsim":"\u22E8","prod":"\u220F","Product":"\u220F","profalar":"\u232E","profline":"\u2312","profsurf":"\u2313","prop":"\u221D","Proportional":"\u221D","Proportion":"\u2237","propto":"\u221D","prsim":"\u227E","prurel":"\u22B0","Pscr":"\uD835\uDCAB","pscr":"\uD835\uDCC5","Psi":"\u03A8","psi":"\u03C8","puncsp":"\u2008","Qfr":"\uD835\uDD14","qfr":"\uD835\uDD2E","qint":"\u2A0C","qopf":"\uD835\uDD62","Qopf":"\u211A","qprime":"\u2057","Qscr":"\uD835\uDCAC","qscr":"\uD835\uDCC6","quaternions":"\u210D","quatint":"\u2A16","quest":"?","questeq":"\u225F","quot":"\"","QUOT":"\"","rAarr":"\u21DB","race":"\u223D\u0331","Racute":"\u0154","racute":"\u0155","radic":"\u221A","raemptyv":"\u29B3","rang":"\u27E9","Rang":"\u27EB","rangd":"\u2992","range":"\u29A5","rangle":"\u27E9","raquo":"\u00BB","rarrap":"\u2975","rarrb":"\u21E5","rarrbfs":"\u2920","rarrc":"\u2933","rarr":"\u2192","Rarr":"\u21A0","rArr":"\u21D2","rarrfs":"\u291E","rarrhk":"\u21AA","rarrlp":"\u21AC","rarrpl":"\u2945","rarrsim":"\u2974","Rarrtl":"\u2916","rarrtl":"\u21A3","rarrw":"\u219D","ratail":"\u291A","rAtail":"\u291C","ratio":"\u2236","rationals":"\u211A","rbarr":"\u290D","rBarr":"\u290F","RBarr":"\u2910","rbbrk":"\u2773","rbrace":"}","rbrack":"]","rbrke":"\u298C","rbrksld":"\u298E","rbrkslu":"\u2990","Rcaron":"\u0158","rcaron":"\u0159","Rcedil":"\u0156","rcedil":"\u0157","rceil":"\u2309","rcub":"}","Rcy":"\u0420","rcy":"\u0440","rdca":"\u2937","rdldhar":"\u2969","rdquo":"\u201D","rdquor":"\u201D","rdsh":"\u21B3","real":"\u211C","realine":"\u211B","realpart":"\u211C","reals":"\u211D","Re":"\u211C","rect":"\u25AD","reg":"\u00AE","REG":"\u00AE","ReverseElement":"\u220B","ReverseEquilibrium":"\u21CB","ReverseUpEquilibrium":"\u296F","rfisht":"\u297D","rfloor":"\u230B","rfr":"\uD835\uDD2F","Rfr":"\u211C","rHar":"\u2964","rhard":"\u21C1","rharu":"\u21C0","rharul":"\u296C","Rho":"\u03A1","rho":"\u03C1","rhov":"\u03F1","RightAngleBracket":"\u27E9","RightArrowBar":"\u21E5","rightarrow":"\u2192","RightArrow":"\u2192","Rightarrow":"\u21D2","RightArrowLeftArrow":"\u21C4","rightarrowtail":"\u21A3","RightCeiling":"\u2309","RightDoubleBracket":"\u27E7","RightDownTeeVector":"\u295D","RightDownVectorBar":"\u2955","RightDownVector":"\u21C2","RightFloor":"\u230B","rightharpoondown":"\u21C1","rightharpoonup":"\u21C0","rightleftarrows":"\u21C4","rightleftharpoons":"\u21CC","rightrightarrows":"\u21C9","rightsquigarrow":"\u219D","RightTeeArrow":"\u21A6","RightTee":"\u22A2","RightTeeVector":"\u295B","rightthreetimes":"\u22CC","RightTriangleBar":"\u29D0","RightTriangle":"\u22B3","RightTriangleEqual":"\u22B5","RightUpDownVector":"\u294F","RightUpTeeVector":"\u295C","RightUpVectorBar":"\u2954","RightUpVector":"\u21BE","RightVectorBar":"\u2953","RightVector":"\u21C0","ring":"\u02DA","risingdotseq":"\u2253","rlarr":"\u21C4","rlhar":"\u21CC","rlm":"\u200F","rmoustache":"\u23B1","rmoust":"\u23B1","rnmid":"\u2AEE","roang":"\u27ED","roarr":"\u21FE","robrk":"\u27E7","ropar":"\u2986","ropf":"\uD835\uDD63","Ropf":"\u211D","roplus":"\u2A2E","rotimes":"\u2A35","RoundImplies":"\u2970","rpar":")","rpargt":"\u2994","rppolint":"\u2A12","rrarr":"\u21C9","Rrightarrow":"\u21DB","rsaquo":"\u203A","rscr":"\uD835\uDCC7","Rscr":"\u211B","rsh":"\u21B1","Rsh":"\u21B1","rsqb":"]","rsquo":"\u2019","rsquor":"\u2019","rthree":"\u22CC","rtimes":"\u22CA","rtri":"\u25B9","rtrie":"\u22B5","rtrif":"\u25B8","rtriltri":"\u29CE","RuleDelayed":"\u29F4","ruluhar":"\u2968","rx":"\u211E","Sacute":"\u015A","sacute":"\u015B","sbquo":"\u201A","scap":"\u2AB8","Scaron":"\u0160","scaron":"\u0161","Sc":"\u2ABC","sc":"\u227B","sccue":"\u227D","sce":"\u2AB0","scE":"\u2AB4","Scedil":"\u015E","scedil":"\u015F","Scirc":"\u015C","scirc":"\u015D","scnap":"\u2ABA","scnE":"\u2AB6","scnsim":"\u22E9","scpolint":"\u2A13","scsim":"\u227F","Scy":"\u0421","scy":"\u0441","sdotb":"\u22A1","sdot":"\u22C5","sdote":"\u2A66","searhk":"\u2925","searr":"\u2198","seArr":"\u21D8","searrow":"\u2198","sect":"\u00A7","semi":";","seswar":"\u2929","setminus":"\u2216","setmn":"\u2216","sext":"\u2736","Sfr":"\uD835\uDD16","sfr":"\uD835\uDD30","sfrown":"\u2322","sharp":"\u266F","SHCHcy":"\u0429","shchcy":"\u0449","SHcy":"\u0428","shcy":"\u0448","ShortDownArrow":"\u2193","ShortLeftArrow":"\u2190","shortmid":"\u2223","shortparallel":"\u2225","ShortRightArrow":"\u2192","ShortUpArrow":"\u2191","shy":"\u00AD","Sigma":"\u03A3","sigma":"\u03C3","sigmaf":"\u03C2","sigmav":"\u03C2","sim":"\u223C","simdot":"\u2A6A","sime":"\u2243","simeq":"\u2243","simg":"\u2A9E","simgE":"\u2AA0","siml":"\u2A9D","simlE":"\u2A9F","simne":"\u2246","simplus":"\u2A24","simrarr":"\u2972","slarr":"\u2190","SmallCircle":"\u2218","smallsetminus":"\u2216","smashp":"\u2A33","smeparsl":"\u29E4","smid":"\u2223","smile":"\u2323","smt":"\u2AAA","smte":"\u2AAC","smtes":"\u2AAC\uFE00","SOFTcy":"\u042C","softcy":"\u044C","solbar":"\u233F","solb":"\u29C4","sol":"/","Sopf":"\uD835\uDD4A","sopf":"\uD835\uDD64","spades":"\u2660","spadesuit":"\u2660","spar":"\u2225","sqcap":"\u2293","sqcaps":"\u2293\uFE00","sqcup":"\u2294","sqcups":"\u2294\uFE00","Sqrt":"\u221A","sqsub":"\u228F","sqsube":"\u2291","sqsubset":"\u228F","sqsubseteq":"\u2291","sqsup":"\u2290","sqsupe":"\u2292","sqsupset":"\u2290","sqsupseteq":"\u2292","square":"\u25A1","Square":"\u25A1","SquareIntersection":"\u2293","SquareSubset":"\u228F","SquareSubsetEqual":"\u2291","SquareSuperset":"\u2290","SquareSupersetEqual":"\u2292","SquareUnion":"\u2294","squarf":"\u25AA","squ":"\u25A1","squf":"\u25AA","srarr":"\u2192","Sscr":"\uD835\uDCAE","sscr":"\uD835\uDCC8","ssetmn":"\u2216","ssmile":"\u2323","sstarf":"\u22C6","Star":"\u22C6","star":"\u2606","starf":"\u2605","straightepsilon":"\u03F5","straightphi":"\u03D5","strns":"\u00AF","sub":"\u2282","Sub":"\u22D0","subdot":"\u2ABD","subE":"\u2AC5","sube":"\u2286","subedot":"\u2AC3","submult":"\u2AC1","subnE":"\u2ACB","subne":"\u228A","subplus":"\u2ABF","subrarr":"\u2979","subset":"\u2282","Subset":"\u22D0","subseteq":"\u2286","subseteqq":"\u2AC5","SubsetEqual":"\u2286","subsetneq":"\u228A","subsetneqq":"\u2ACB","subsim":"\u2AC7","subsub":"\u2AD5","subsup":"\u2AD3","succapprox":"\u2AB8","succ":"\u227B","succcurlyeq":"\u227D","Succeeds":"\u227B","SucceedsEqual":"\u2AB0","SucceedsSlantEqual":"\u227D","SucceedsTilde":"\u227F","succeq":"\u2AB0","succnapprox":"\u2ABA","succneqq":"\u2AB6","succnsim":"\u22E9","succsim":"\u227F","SuchThat":"\u220B","sum":"\u2211","Sum":"\u2211","sung":"\u266A","sup1":"\u00B9","sup2":"\u00B2","sup3":"\u00B3","sup":"\u2283","Sup":"\u22D1","supdot":"\u2ABE","supdsub":"\u2AD8","supE":"\u2AC6","supe":"\u2287","supedot":"\u2AC4","Superset":"\u2283","SupersetEqual":"\u2287","suphsol":"\u27C9","suphsub":"\u2AD7","suplarr":"\u297B","supmult":"\u2AC2","supnE":"\u2ACC","supne":"\u228B","supplus":"\u2AC0","supset":"\u2283","Supset":"\u22D1","supseteq":"\u2287","supseteqq":"\u2AC6","supsetneq":"\u228B","supsetneqq":"\u2ACC","supsim":"\u2AC8","supsub":"\u2AD4","supsup":"\u2AD6","swarhk":"\u2926","swarr":"\u2199","swArr":"\u21D9","swarrow":"\u2199","swnwar":"\u292A","szlig":"\u00DF","Tab":"\t","target":"\u2316","Tau":"\u03A4","tau":"\u03C4","tbrk":"\u23B4","Tcaron":"\u0164","tcaron":"\u0165","Tcedil":"\u0162","tcedil":"\u0163","Tcy":"\u0422","tcy":"\u0442","tdot":"\u20DB","telrec":"\u2315","Tfr":"\uD835\uDD17","tfr":"\uD835\uDD31","there4":"\u2234","therefore":"\u2234","Therefore":"\u2234","Theta":"\u0398","theta":"\u03B8","thetasym":"\u03D1","thetav":"\u03D1","thickapprox":"\u2248","thicksim":"\u223C","ThickSpace":"\u205F\u200A","ThinSpace":"\u2009","thinsp":"\u2009","thkap":"\u2248","thksim":"\u223C","THORN":"\u00DE","thorn":"\u00FE","tilde":"\u02DC","Tilde":"\u223C","TildeEqual":"\u2243","TildeFullEqual":"\u2245","TildeTilde":"\u2248","timesbar":"\u2A31","timesb":"\u22A0","times":"\u00D7","timesd":"\u2A30","tint":"\u222D","toea":"\u2928","topbot":"\u2336","topcir":"\u2AF1","top":"\u22A4","Topf":"\uD835\uDD4B","topf":"\uD835\uDD65","topfork":"\u2ADA","tosa":"\u2929","tprime":"\u2034","trade":"\u2122","TRADE":"\u2122","triangle":"\u25B5","triangledown":"\u25BF","triangleleft":"\u25C3","trianglelefteq":"\u22B4","triangleq":"\u225C","triangleright":"\u25B9","trianglerighteq":"\u22B5","tridot":"\u25EC","trie":"\u225C","triminus":"\u2A3A","TripleDot":"\u20DB","triplus":"\u2A39","trisb":"\u29CD","tritime":"\u2A3B","trpezium":"\u23E2","Tscr":"\uD835\uDCAF","tscr":"\uD835\uDCC9","TScy":"\u0426","tscy":"\u0446","TSHcy":"\u040B","tshcy":"\u045B","Tstrok":"\u0166","tstrok":"\u0167","twixt":"\u226C","twoheadleftarrow":"\u219E","twoheadrightarrow":"\u21A0","Uacute":"\u00DA","uacute":"\u00FA","uarr":"\u2191","Uarr":"\u219F","uArr":"\u21D1","Uarrocir":"\u2949","Ubrcy":"\u040E","ubrcy":"\u045E","Ubreve":"\u016C","ubreve":"\u016D","Ucirc":"\u00DB","ucirc":"\u00FB","Ucy":"\u0423","ucy":"\u0443","udarr":"\u21C5","Udblac":"\u0170","udblac":"\u0171","udhar":"\u296E","ufisht":"\u297E","Ufr":"\uD835\uDD18","ufr":"\uD835\uDD32","Ugrave":"\u00D9","ugrave":"\u00F9","uHar":"\u2963","uharl":"\u21BF","uharr":"\u21BE","uhblk":"\u2580","ulcorn":"\u231C","ulcorner":"\u231C","ulcrop":"\u230F","ultri":"\u25F8","Umacr":"\u016A","umacr":"\u016B","uml":"\u00A8","UnderBar":"_","UnderBrace":"\u23DF","UnderBracket":"\u23B5","UnderParenthesis":"\u23DD","Union":"\u22C3","UnionPlus":"\u228E","Uogon":"\u0172","uogon":"\u0173","Uopf":"\uD835\uDD4C","uopf":"\uD835\uDD66","UpArrowBar":"\u2912","uparrow":"\u2191","UpArrow":"\u2191","Uparrow":"\u21D1","UpArrowDownArrow":"\u21C5","updownarrow":"\u2195","UpDownArrow":"\u2195","Updownarrow":"\u21D5","UpEquilibrium":"\u296E","upharpoonleft":"\u21BF","upharpoonright":"\u21BE","uplus":"\u228E","UpperLeftArrow":"\u2196","UpperRightArrow":"\u2197","upsi":"\u03C5","Upsi":"\u03D2","upsih":"\u03D2","Upsilon":"\u03A5","upsilon":"\u03C5","UpTeeArrow":"\u21A5","UpTee":"\u22A5","upuparrows":"\u21C8","urcorn":"\u231D","urcorner":"\u231D","urcrop":"\u230E","Uring":"\u016E","uring":"\u016F","urtri":"\u25F9","Uscr":"\uD835\uDCB0","uscr":"\uD835\uDCCA","utdot":"\u22F0","Utilde":"\u0168","utilde":"\u0169","utri":"\u25B5","utrif":"\u25B4","uuarr":"\u21C8","Uuml":"\u00DC","uuml":"\u00FC","uwangle":"\u29A7","vangrt":"\u299C","varepsilon":"\u03F5","varkappa":"\u03F0","varnothing":"\u2205","varphi":"\u03D5","varpi":"\u03D6","varpropto":"\u221D","varr":"\u2195","vArr":"\u21D5","varrho":"\u03F1","varsigma":"\u03C2","varsubsetneq":"\u228A\uFE00","varsubsetneqq":"\u2ACB\uFE00","varsupsetneq":"\u228B\uFE00","varsupsetneqq":"\u2ACC\uFE00","vartheta":"\u03D1","vartriangleleft":"\u22B2","vartriangleright":"\u22B3","vBar":"\u2AE8","Vbar":"\u2AEB","vBarv":"\u2AE9","Vcy":"\u0412","vcy":"\u0432","vdash":"\u22A2","vDash":"\u22A8","Vdash":"\u22A9","VDash":"\u22AB","Vdashl":"\u2AE6","veebar":"\u22BB","vee":"\u2228","Vee":"\u22C1","veeeq":"\u225A","vellip":"\u22EE","verbar":"|","Verbar":"\u2016","vert":"|","Vert":"\u2016","VerticalBar":"\u2223","VerticalLine":"|","VerticalSeparator":"\u2758","VerticalTilde":"\u2240","VeryThinSpace":"\u200A","Vfr":"\uD835\uDD19","vfr":"\uD835\uDD33","vltri":"\u22B2","vnsub":"\u2282\u20D2","vnsup":"\u2283\u20D2","Vopf":"\uD835\uDD4D","vopf":"\uD835\uDD67","vprop":"\u221D","vrtri":"\u22B3","Vscr":"\uD835\uDCB1","vscr":"\uD835\uDCCB","vsubnE":"\u2ACB\uFE00","vsubne":"\u228A\uFE00","vsupnE":"\u2ACC\uFE00","vsupne":"\u228B\uFE00","Vvdash":"\u22AA","vzigzag":"\u299A","Wcirc":"\u0174","wcirc":"\u0175","wedbar":"\u2A5F","wedge":"\u2227","Wedge":"\u22C0","wedgeq":"\u2259","weierp":"\u2118","Wfr":"\uD835\uDD1A","wfr":"\uD835\uDD34","Wopf":"\uD835\uDD4E","wopf":"\uD835\uDD68","wp":"\u2118","wr":"\u2240","wreath":"\u2240","Wscr":"\uD835\uDCB2","wscr":"\uD835\uDCCC","xcap":"\u22C2","xcirc":"\u25EF","xcup":"\u22C3","xdtri":"\u25BD","Xfr":"\uD835\uDD1B","xfr":"\uD835\uDD35","xharr":"\u27F7","xhArr":"\u27FA","Xi":"\u039E","xi":"\u03BE","xlarr":"\u27F5","xlArr":"\u27F8","xmap":"\u27FC","xnis":"\u22FB","xodot":"\u2A00","Xopf":"\uD835\uDD4F","xopf":"\uD835\uDD69","xoplus":"\u2A01","xotime":"\u2A02","xrarr":"\u27F6","xrArr":"\u27F9","Xscr":"\uD835\uDCB3","xscr":"\uD835\uDCCD","xsqcup":"\u2A06","xuplus":"\u2A04","xutri":"\u25B3","xvee":"\u22C1","xwedge":"\u22C0","Yacute":"\u00DD","yacute":"\u00FD","YAcy":"\u042F","yacy":"\u044F","Ycirc":"\u0176","ycirc":"\u0177","Ycy":"\u042B","ycy":"\u044B","yen":"\u00A5","Yfr":"\uD835\uDD1C","yfr":"\uD835\uDD36","YIcy":"\u0407","yicy":"\u0457","Yopf":"\uD835\uDD50","yopf":"\uD835\uDD6A","Yscr":"\uD835\uDCB4","yscr":"\uD835\uDCCE","YUcy":"\u042E","yucy":"\u044E","yuml":"\u00FF","Yuml":"\u0178","Zacute":"\u0179","zacute":"\u017A","Zcaron":"\u017D","zcaron":"\u017E","Zcy":"\u0417","zcy":"\u0437","Zdot":"\u017B","zdot":"\u017C","zeetrf":"\u2128","ZeroWidthSpace":"\u200B","Zeta":"\u0396","zeta":"\u03B6","zfr":"\uD835\uDD37","Zfr":"\u2128","ZHcy":"\u0416","zhcy":"\u0436","zigrarr":"\u21DD","zopf":"\uD835\uDD6B","Zopf":"\u2124","Zscr":"\uD835\uDCB5","zscr":"\uD835\uDCCF","zwj":"\u200D","zwnj":"\u200C"}
},{}],38:[function(require,module,exports){
module.exports={"Aacute":"\u00C1","aacute":"\u00E1","Acirc":"\u00C2","acirc":"\u00E2","acute":"\u00B4","AElig":"\u00C6","aelig":"\u00E6","Agrave":"\u00C0","agrave":"\u00E0","amp":"&","AMP":"&","Aring":"\u00C5","aring":"\u00E5","Atilde":"\u00C3","atilde":"\u00E3","Auml":"\u00C4","auml":"\u00E4","brvbar":"\u00A6","Ccedil":"\u00C7","ccedil":"\u00E7","cedil":"\u00B8","cent":"\u00A2","copy":"\u00A9","COPY":"\u00A9","curren":"\u00A4","deg":"\u00B0","divide":"\u00F7","Eacute":"\u00C9","eacute":"\u00E9","Ecirc":"\u00CA","ecirc":"\u00EA","Egrave":"\u00C8","egrave":"\u00E8","ETH":"\u00D0","eth":"\u00F0","Euml":"\u00CB","euml":"\u00EB","frac12":"\u00BD","frac14":"\u00BC","frac34":"\u00BE","gt":">","GT":">","Iacute":"\u00CD","iacute":"\u00ED","Icirc":"\u00CE","icirc":"\u00EE","iexcl":"\u00A1","Igrave":"\u00CC","igrave":"\u00EC","iquest":"\u00BF","Iuml":"\u00CF","iuml":"\u00EF","laquo":"\u00AB","lt":"<","LT":"<","macr":"\u00AF","micro":"\u00B5","middot":"\u00B7","nbsp":"\u00A0","not":"\u00AC","Ntilde":"\u00D1","ntilde":"\u00F1","Oacute":"\u00D3","oacute":"\u00F3","Ocirc":"\u00D4","ocirc":"\u00F4","Ograve":"\u00D2","ograve":"\u00F2","ordf":"\u00AA","ordm":"\u00BA","Oslash":"\u00D8","oslash":"\u00F8","Otilde":"\u00D5","otilde":"\u00F5","Ouml":"\u00D6","ouml":"\u00F6","para":"\u00B6","plusmn":"\u00B1","pound":"\u00A3","quot":"\"","QUOT":"\"","raquo":"\u00BB","reg":"\u00AE","REG":"\u00AE","sect":"\u00A7","shy":"\u00AD","sup1":"\u00B9","sup2":"\u00B2","sup3":"\u00B3","szlig":"\u00DF","THORN":"\u00DE","thorn":"\u00FE","times":"\u00D7","Uacute":"\u00DA","uacute":"\u00FA","Ucirc":"\u00DB","ucirc":"\u00FB","Ugrave":"\u00D9","ugrave":"\u00F9","uml":"\u00A8","Uuml":"\u00DC","uuml":"\u00FC","Yacute":"\u00DD","yacute":"\u00FD","yen":"\u00A5","yuml":"\u00FF"}
},{}],39:[function(require,module,exports){
module.exports={"amp":"&","apos":"'","gt":">","lt":"<","quot":"\""}

},{}],40:[function(require,module,exports){
var Parser = require("./Parser.js"),
    DomHandler = require("domhandler");

function defineProp(name, value){
	delete module.exports[name];
	module.exports[name] = value;
	return value;
}

module.exports = {
	Parser: Parser,
	Tokenizer: require("./Tokenizer.js"),
	ElementType: require("domelementtype"),
	DomHandler: DomHandler,
	get FeedHandler(){
		return defineProp("FeedHandler", require("./FeedHandler.js"));
	},
    /*
	get Stream(){
		return defineProp("Stream", require("./Stream.js"));
	},
	get WritableStream(){
		return defineProp("WritableStream", require("./WritableStream.js"));
	},
    */
	get ProxyHandler(){
		return defineProp("ProxyHandler", require("./ProxyHandler.js"));
	},
	get DomUtils(){
		return defineProp("DomUtils", require("domutils"));
	},
	get CollectingHandler(){
		return defineProp("CollectingHandler", require("./CollectingHandler.js"));
	},
	// For legacy support
	DefaultHandler: DomHandler,
	get RssHandler(){
		return defineProp("RssHandler", this.FeedHandler);
	},
	//helper methods
	parseDOM: function(data, options) {
		var handler = new DomHandler(options);
		var parser = new Parser(handler, options);
		parser.end(data);
		return handler.dom;
	},
	parseFeed: function(feed, options){
		var handler = new module.exports.FeedHandler(options);
		var parser = new Parser(handler, options);
		parser.end(feed);
		return handler.dom;
	},
	createDomStream: function(cb, options, elementCb){
		var handler = new DomHandler(cb, options, elementCb);
		return new Parser(handler, options);
	},
	// List of all events that the parser emits
	EVENTS: { /* Format: eventname: number of arguments */
		attribute: 2,
		cdatastart: 0,
		cdataend: 0,
		text: 1,
		processinginstruction: 2,
		comment: 1,
		commentend: 0,
		closetag: 1,
		opentag: 2,
		opentagname: 1,
		error: 1,
		end: 0
	}
};

},{"./CollectingHandler.js":31,"./FeedHandler.js":32,"./Parser.js":33,"./ProxyHandler.js":34,"./Tokenizer.js":35,"domelementtype":41,"domhandler":42,"domutils":43}],41:[function(require,module,exports){
module.exports=require(26)
},{}],42:[function(require,module,exports){
var ElementType = require("domelementtype");

var re_whitespace = /\s+/g;

function DomHandler(callback, options, elementCB){
	if(typeof callback === "object"){
		elementCB = options;
		options = callback;
		callback = null;
	} else if(typeof options === "function"){
		elementCB = options;
		options = defaultOpts;
	}
	this._callback = callback;
	this._options = options || defaultOpts;
	this._elementCB = elementCB;
	this.dom = [];
	this._done = false;
	this._tagStack = [];
}

//default options
var defaultOpts = {
	normalizeWhitespace: false //Replace all whitespace with single spaces
};

//Resets the handler back to starting state
DomHandler.prototype.onreset = function(){
	DomHandler.call(this, this._callback, this._options, this._elementCB);
};

//Signals the handler that parsing is done
DomHandler.prototype.onend = function(){
	if(this._done) return;
	this._done = true;
	this._handleCallback(null);
};

DomHandler.prototype._handleCallback =
DomHandler.prototype.onerror = function(error){
	if(typeof this._callback === "function"){
		this._callback(error, this.dom);
	} else {
		if(error) throw error;
	}
};

DomHandler.prototype.onclosetag = function(){
	//if(this._tagStack.pop().name !== name) this._handleCallback(Error("Tagname didn't match!"));
	var elem = this._tagStack.pop();
	if(this._elementCB) this._elementCB(elem);
};

DomHandler.prototype._addDomElement = function(element){
	var parent = this._tagStack[this._tagStack.length - 1];
	var siblings = parent ? parent.children : this.dom;
	var previousSibling = siblings[siblings.length - 1];

	element.next = null;

	if (this._options.withDomLvl1) {
		element.__proto__ = NodePrototype;
	}

	if(previousSibling){
		element.prev = previousSibling;
		previousSibling.next = element;
	} else {
		element.prev = null;
	}

	siblings.push(element);
	element.parent = parent || null;
};

// This object will be used as the prototype for Nodes when creating a
// DOM-Level-1-compliant structure.
var NodePrototype = {
	get firstChild() {
		var children = this.children;
		return children && children[0] || null;
	},
	get lastChild() {
		var children = this.children;
		return children && children[children.length - 1] || null;
	},
	get nodeType() {
		return nodeTypes[this.type] || nodeTypes.element;
	}
};
var domLvl1 = {
	tagName: "name",
	childNodes: "children",
	parentNode: "parent",
	previousSibling: "prev",
	nextSibling: "next",
	nodeValue: "data"
};
var nodeTypes = {
	element: 1,
	text: 3,
	cdata: 4,
	comment: 8
};
Object.keys(domLvl1).forEach(function(key) {
	var shorthand = domLvl1[key];
	Object.defineProperty(NodePrototype, key, {
		get: function() {
			return this[shorthand] || null;
		},
		set: function(val) {
			this[shorthand] = val;
			return val;
		}
	});
});

DomHandler.prototype.onopentag = function(name, attribs){
	var element = {
		type: name === "script" ? ElementType.Script : name === "style" ? ElementType.Style : ElementType.Tag,
		name: name,
		attribs: attribs,
		children: []
	};

	this._addDomElement(element);

	this._tagStack.push(element);
};

DomHandler.prototype.ontext = function(data){
	//the ignoreWhitespace is officially dropped, but for now,
	//it's an alias for normalizeWhitespace
	var normalize = this._options.normalizeWhitespace || this._options.ignoreWhitespace;

	var lastTag;

	if(!this._tagStack.length && this.dom.length && (lastTag = this.dom[this.dom.length-1]).type === ElementType.Text){
		if(normalize){
			lastTag.data = (lastTag.data + data).replace(re_whitespace, " ");
		} else {
			lastTag.data += data;
		}
	} else {
		if(
			this._tagStack.length &&
			(lastTag = this._tagStack[this._tagStack.length - 1]) &&
			(lastTag = lastTag.children[lastTag.children.length - 1]) &&
			lastTag.type === ElementType.Text
		){
			if(normalize){
				lastTag.data = (lastTag.data + data).replace(re_whitespace, " ");
			} else {
				lastTag.data += data;
			}
		} else {
			if(normalize){
				data = data.replace(re_whitespace, " ");
			}

			this._addDomElement({
				data: data,
				type: ElementType.Text
			});
		}
	}
};

DomHandler.prototype.oncomment = function(data){
	var lastTag = this._tagStack[this._tagStack.length - 1];

	if(lastTag && lastTag.type === ElementType.Comment){
		lastTag.data += data;
		return;
	}

	var element = {
		data: data,
		type: ElementType.Comment
	};

	this._addDomElement(element);
	this._tagStack.push(element);
};

DomHandler.prototype.oncdatastart = function(){
	var element = {
		children: [{
			data: "",
			type: ElementType.Text
		}],
		type: ElementType.CDATA
	};

	this._addDomElement(element);
	this._tagStack.push(element);
};

DomHandler.prototype.oncommentend = DomHandler.prototype.oncdataend = function(){
	this._tagStack.pop();
};

DomHandler.prototype.onprocessinginstruction = function(name, data){
	this._addDomElement({
		name: name,
		data: data,
		type: ElementType.Directive
	});
};

module.exports = DomHandler;

},{"domelementtype":41}],43:[function(require,module,exports){
var DomUtils = module.exports;

[
	"stringify", "traversal", "manipulation", "querying", "legacy", "helpers"
].forEach(function(name){
	var ext = require("./lib/" + name);
	Object.keys(ext).forEach(function(key){
		DomUtils[key] = ext[key].bind(DomUtils);
	});
});

},{}],44:[function(require,module,exports){
//     Underscore.js 1.5.2
//     http://underscorejs.org
//     (c) 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.5.2';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      var keys = _.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    return _.filter(obj, function(value, index, list) {
      return !iterator.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs, first) {
    if (_.isEmpty(attrs)) return first ? void 0 : [];
    return _[first ? 'find' : 'filter'](obj, function(value) {
      for (var key in attrs) {
        if (attrs[key] !== value[key]) return false;
      }
      return true;
    });
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.where(obj, attrs, true);
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity, value: -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed > result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity, value: Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array, using the modern version of the 
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sample **n** random values from an array.
  // If **n** is not specified, returns a single random element from the array.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (arguments.length < 2 || guard) {
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    return _.isFunction(value) ? value : function(obj){ return obj[value]; };
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, value, context) {
    var iterator = lookupIterator(value);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, value, context) {
      var result = {};
      var iterator = value == null ? _.identity : lookupIterator(value);
      each(obj, function(value, index) {
        var key = iterator.call(context, value, index, obj);
        behavior(result, key, value);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, key, value) {
    (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, key, value) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, key) {
    _.has(result, key) ? result[key]++ : result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = iterator == null ? _.identity : lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    return (n == null) || guard ? array[0] : slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) {
      return array[array.length - 1];
    } else {
      return slice.call(array, Math.max(array.length - n, 0));
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    each(input, function(value) {
      if (_.isArray(value) || _.isArguments(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var length = _.max(_.pluck(arguments, "length").concat(0));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, '' + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(length);

    while(idx < length) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context.
  _.partial = function(func) {
    var args = slice.call(arguments, 1);
    return function() {
      return func.apply(this, args.concat(slice.call(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error("bindAll must be passed function names");
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function() {
      previous = options.leading === false ? 0 : new Date;
      timeout = null;
      result = func.apply(context, args);
    };
    return function() {
      var now = new Date;
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;
    return function() {
      context = this;
      args = arguments;
      timestamp = new Date();
      var later = function() {
        var last = (new Date()) - timestamp;
        if (last < wait) {
          timeout = setTimeout(later, wait - last);
        } else {
          timeout = null;
          if (!immediate) result = func.apply(context, args);
        }
      };
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) result = func.apply(context, args);
      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = new Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = new Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                             _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(Math.max(0, n));
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

}).call(this);

},{}],45:[function(require,module,exports){
module.exports={
  "author": "Matt Mueller <mattmuelle@gmail.com> (mattmueller.me)",
  "name": "cheerio",
  "description": "Tiny, fast, and elegant implementation of core jQuery designed specifically for the server",
  "keywords": [
    "htmlparser",
    "jquery",
    "selector",
    "scraper"
  ],
  "version": "0.13.1",
  "repository": {
    "type": "git",
    "url": "git://github.com/MatthewMueller/cheerio.git"
  },
  "main": "./index.js",
  "engines": {
    "node": ">= 0.6"
  },
  "dependencies": {
    "htmlparser2": "~3.4.0",
    "underscore": "1.5.2",
    "entities": "0.x",
    "CSSselect": "~0.4.0"
  },
  "devDependencies": {
    "mocha": "*",
    "expect.js": "*",
    "jshint": "~2.3.0",
    "benchmark": "~1.0.0",
    "jsdom": "~0.8.9"
  },
  "scripts": {
    "test": "make test"
  }
}

},{}],46:[function(require,module,exports){
/**
 * Export cheerio (with )
 */

exports = module.exports = require('./lib/cheerio');

/*
  Export the version
*/

exports.version = require('./package').version;

},{"./lib/cheerio":5,"./package":45}],47:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],48:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],49:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],50:[function(require,module,exports){
var process=require("__browserify_process");// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

},{"__browserify_process":49}],51:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],52:[function(require,module,exports){
var process=require("__browserify_process"),global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

},{"./support/isBuffer":51,"__browserify_process":49,"inherits":48}]},{},[46])
(46)
});
