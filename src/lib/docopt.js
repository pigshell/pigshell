var docopt = function() {
  var AnyOptions, Argument, Command, Dict, DocoptExit, DocoptLanguageError, Either, OneOrMore, Option, Optional, Pattern, Required, TokenStream, atos, docopt, error, extras, formal_usage, parse_args, parse_atom, parse_doc_options, parse_expr, parse_long, parse_pattern, parse_seq, parse_shorts, printable_usage,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  error = null;

  atos = Array.prototype.toString;

/*
 * Very bad idea to override prototypes of basic types! D3 relies on
 * "a" + [1,2] + "b" giving a1,2b
 *
  Array.prototype.toString = function() {
    return '[' + atos.call(this) + ']';
  };
*/
  DocoptLanguageError = (function(_super) {

    __extends(DocoptLanguageError, _super);

    function DocoptLanguageError(message) {
      this.message = message;
      DocoptLanguageError.__super__.constructor.call(this, this.message);
      error = this.message;
    }

    return DocoptLanguageError;

  })(Error);

  DocoptExit = (function(_super) {

    __extends(DocoptExit, _super);

    function DocoptExit(message) {
      DocoptExit.__super__.constructor.call(this, message);
      this.message = message;
      error = this.message;
    }

    return DocoptExit;

  })(Error);

  Pattern = (function() {

    function Pattern(children) {
      this.children = children != null ? children : [];
    }

    Pattern.prototype.valueOf = Pattern.toString;

    Pattern.prototype.toString = function() {
      var formals;
      formals = this.children.join(', ');
      return "" + this.constructor.name + "(" + formals + ")";
    };

    Pattern.prototype.match = function() {
      throw new Error("classes inheriting from Pattern\nmust overload the match method");
    };

    Pattern.prototype.flat = function() {
      var child, res, _i, _len, _ref;
      if (!this.hasOwnProperty('children')) {
        return [this];
      }
      res = [];
      _ref = this.children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        res = res.concat(child.flat());
      }
      return res;
    };

    Pattern.prototype.fix = function() {
      this.fix_identities();
      return this.fix_list_arguments();
    };

    Pattern.prototype.fix_identities = function(uniq) {
      var c, enumerate, flat, i, k, _i, _j, _len, _len1, _ref, _ref1;
      if (uniq == null) {
        uniq = null;
      }

      if (!this.hasOwnProperty('children')) {
        return this;
      }
      if (uniq === null) {
        _ref = [{}, this.flat()], uniq = _ref[0], flat = _ref[1];
        for (_i = 0, _len = flat.length; _i < _len; _i++) {
          k = flat[_i];
          uniq[k] = k;
        }
      }
      i = 0;
      enumerate = (function() {
        var _j, _len1, _ref1, _results;
        _ref1 = this.children;
        _results = [];
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          c = _ref1[_j];
          _results.push([i++, c]);
        }
        return _results;
      }).call(this);
      for (_j = 0, _len1 = enumerate.length; _j < _len1; _j++) {
        _ref1 = enumerate[_j], i = _ref1[0], c = _ref1[1];
        if (!c.hasOwnProperty('children')) {
          this.children[i] = uniq[c];
        } else {
          c.fix_identities(uniq);
        }
      }
      return this;
    };

    Pattern.prototype.fix_list_arguments = function() {

      var c, child, counts, e, either, _i, _j, _k, _len, _len1, _len2, _ref;
      either = (function() {
        var _i, _len, _ref, _results;
        _ref = this.either().children;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          c = _ref[_i];
          _results.push(c.children);
        }
        return _results;
      }).call(this);
      for (_i = 0, _len = either.length; _i < _len; _i++) {
        child = either[_i];
        counts = {};
        for (_j = 0, _len1 = child.length; _j < _len1; _j++) {
          c = child[_j];
          counts[c] = ((_ref = counts[c]) != null ? _ref : 0) + 1;
        }
        for (_k = 0, _len2 = child.length; _k < _len2; _k++) {
          e = child[_k];
          if (counts[e] > 1 && e.constructor === Argument) {
            e.value = [];
          }
        }
      }
      return this;
    };

    Pattern.prototype.either = function() {
      var c, children, e, either, group, groups, i, indices, name, oneormore, optional, required, ret, types, zip, _i, _j, _len, _len1, _ref, _ref1, _ref2;
      if (!this.hasOwnProperty('children')) {
        return new Either([new Required([this])]);
      } else {
        ret = [];
        groups = [[this]];
        while (groups.length) {
          children = groups.shift();
          _ref = [0, {}, {}], i = _ref[0], indices = _ref[1], types = _ref[2];
          zip = (function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = children.length; _i < _len; _i++) {
              c = children[_i];
              _results.push([i++, c]);
            }
            return _results;
          })();
          for (_i = 0, _len = zip.length; _i < _len; _i++) {
            _ref1 = zip[_i], i = _ref1[0], c = _ref1[1];
            name = c.constructor.name;
            if (!(name in types)) {
              types[name] = [];
            }
            types[name].push(c);
            if (!(c in indices)) {
              indices[c] = i;
            }
          }
          if (either = types[Either.name]) {
            either = either[0];
            children.splice(indices[either], 1);
            _ref2 = either.children;
            for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
              c = _ref2[_j];
              group = [c].concat(children);
              groups.push(group);
            }
          } else if (required = types[Required.name]) {
            required = required[0];
            children.splice(indices[required], 1);
            group = required.children.concat(children);
            groups.push(group);
          } else if (optional = types[Optional.name]) {
            optional = optional[0];
            children.splice(indices[optional], 1);
            group = optional.children.concat(children);
            groups.push(group);
          } else if (oneormore = types[OneOrMore.name]) {
            oneormore = oneormore[0];
            children.splice(indices[oneormore], 1);
            group = oneormore.children;
            group = group.concat(group, children);
            groups.push(group);
          } else {
            ret.push(children);
          }
        }
        return new Either((function() {
          var _k, _len2, _results;
          _results = [];
          for (_k = 0, _len2 = ret.length; _k < _len2; _k++) {
            e = ret[_k];
            _results.push(new Required(e));
          }
          return _results;
        })());
      }
    };

    return Pattern;

  })();

  Argument = (function(_super) {

    __extends(Argument, _super);

    function Argument(argname, value) {
      this.argname = argname;
      this.value = value != null ? value : null;
    }

    Argument.prototype.name = function() {
      return this.argname;
    };

    Argument.prototype.toString = function() {
      return "Argument(" + this.argname + ", " + this.value + ")";
    };

    Argument.prototype.match = function(left, collected) {
      var a, args, l, same_name;
      if (collected == null) {
        collected = [];
      }
      args = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = left.length; _i < _len; _i++) {
          l = left[_i];
          if (l.constructor === Argument) {
            _results.push(l);
          }
        }
        return _results;
      })();
      if (!args.length) {
        return [false, left, collected];
      }
      left = (function() {
        var _i, _len, _results, _done = false;
        _results = [];
        for (_i = 0, _len = left.length; _i < _len; _i++) {
          l = left[_i];
          if (!_done && l.toString() === args[0].toString()) {
            _done = true;
          } else {
            _results.push(l);
          }
        }
        return _results;
      })();
      if (this.value === null || this.value.constructor !== Array) {
        collected = collected.concat([new Argument(this.name(), args[0].value)]);
        return [true, left, collected];
      }
      same_name = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = collected.length; _i < _len; _i++) {
          a = collected[_i];
          if (a.constructor === Argument && a.name() === this.name()) {
            _results.push(a);
          }
        }
        return _results;
      }).call(this);
      if (same_name.length > 0) {
        same_name[0].value.push(args[0].value);
        return [true, left, collected];
      } else {
        collected = collected.concat([new Argument(this.name(), [args[0].value])]);
        return [true, left, collected];
      }
    };

    return Argument;

  })(Pattern);

  Command = (function(_super) {

    __extends(Command, _super);

    function Command(cmdname, value) {
      this.cmdname = cmdname;
      this.value = value != null ? value : false;
    }

    Command.prototype.name = function() {
      return this.cmdname;
    };

    Command.prototype.toString = function() {
      return "Command(" + this.cmdname + ", " + this.value + ")";
    };

    Command.prototype.match = function(left, collected) {
      var args, l;
      if (collected == null) {
        collected = [];
      }
      args = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = left.length; _i < _len; _i++) {
          l = left[_i];
          if (l.constructor === Argument) {
            _results.push(l);
          }
        }
        return _results;
      })();
      if (!args.length || args[0].value !== this.name()) {
        return [false, left, collected];
      }
      left.splice(left.indexOf(args[0]), 1);
      collected.push(new Command(this.name(), true));
      return [true, left, collected];
    };

    return Command;

  })(Pattern);

  Option = (function(_super) {

    __extends(Option, _super);

    function Option(shortopt, longopt, argcount, value) {
      this.shortopt = shortopt != null ? shortopt : null;
      this.longopt = longopt != null ? longopt : null;
      this.argcount = argcount != null ? argcount : 0;
      this.value = value != null ? value : false;
    }

    Option.prototype.toString = function() {
      return "Option(" + this.shortopt + ", " + this.longopt + ", " + this.argcount + ", " + this.value + ")";
    };

    Option.prototype.name = function() {
      return this.longopt || this.shortopt;
    };

    Option.parse = function(description) {
      var argcount, longopt, matched, options, s, shortopt, value, _, _i, _len, _ref, _ref1, _ref2, _ref3;
      description = description.replace(/^\s*|\s*$/g, '');
      _ref1 = (_ref = description.match(/(.*?)  (.*)/)) != null ? _ref : [null, description, ''], _ = _ref1[0], options = _ref1[1], description = _ref1[2];
      options = options.replace(/,|=/g, ' ');
      _ref2 = [null, null, 0, false], shortopt = _ref2[0], longopt = _ref2[1], argcount = _ref2[2], value = _ref2[3];
      _ref3 = options.split(/\s+/);
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        s = _ref3[_i];
        if (s.slice(0, 2) === '--') {
          longopt = s;
        } else if (s[0] === '-') {
          shortopt = s;
        } else {
          argcount = 1;
        }
      }
      if (argcount === 1) {
        matched = /\[default:\s+(.*)\]/.exec(description);
        value = matched ? matched[1] : false;
      }
      return new Option(shortopt, longopt, argcount, value);
    };

    Option.prototype.match = function(left, collected) {
      var l, left_;
      if (collected == null) {
        collected = [];
      }
      left_ = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = left.length; _i < _len; _i++) {
          l = left[_i];
          if (l.constructor !== Option || this.shortopt !== l.shortopt || this.longopt !== l.longopt) {
            _results.push(l);
          }
        }
        return _results;
      }).call(this);
      return [left.join(', ') !== left_.join(', '), left_, collected];
    };

    return Option;

  })(Pattern);

  AnyOptions = (function(_super) {

    __extends(AnyOptions, _super);

    function AnyOptions() {
      return AnyOptions.__super__.constructor.apply(this, arguments);
    }

    AnyOptions.prototype.match = function(left, collected) {
      var l, left_;
      if (collected == null) {
        collected = [];
      }
      left_ = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = left.length; _i < _len; _i++) {
          l = left[_i];
          if (l.constructor !== Option) {
            _results.push(l);
          }
        }
        return _results;
      })();
      return [left.join(', ') !== left_.join(', '), left_, collected];
    };

    return AnyOptions;

  })(Pattern);

  Required = (function(_super) {

    __extends(Required, _super);

    function Required() {
      return Required.__super__.constructor.apply(this, arguments);
    }

    Required.prototype.match = function(left, collected) {
      var c, l, matched, p, _i, _len, _ref, _ref1;
      if (collected == null) {
        collected = [];
      }
      l = left;
      c = collected;
      _ref = this.children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        p = _ref[_i];
        _ref1 = p.match(l, c), matched = _ref1[0], l = _ref1[1], c = _ref1[2];
        if (!matched) {
          return [false, left, collected];
        }
      }
      return [true, l, c];
    };

    return Required;

  })(Pattern);

  Optional = (function(_super) {

    __extends(Optional, _super);

    function Optional() {
      return Optional.__super__.constructor.apply(this, arguments);
    }

    Optional.prototype.match = function(left, collected) {
      var m, p, _i, _len, _ref, _ref1;
      if (collected == null) {
        collected = [];
      }
      _ref = this.children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        p = _ref[_i];
        _ref1 = p.match(left, collected), m = _ref1[0], left = _ref1[1], collected = _ref1[2];
      }
      return [true, left, collected];
    };

    return Optional;

  })(Pattern);

  OneOrMore = (function(_super) {

    __extends(OneOrMore, _super);

    function OneOrMore() {
      return OneOrMore.__super__.constructor.apply(this, arguments);
    }

    OneOrMore.prototype.match = function(left, collected) {
      var c, l, l_, matched, times, _ref;
      if (collected == null) {
        collected = [];
      }
      l = left;
      c = collected;
      l_ = [];
      matched = true;
      times = 0;
      while (matched) {
        _ref = this.children[0].match(l, c), matched = _ref[0], l = _ref[1], c = _ref[2];
        times += matched ? 1 : 0;
        if (l_.join(', ') === l.join(', ')) {
          break;
        }
        l_ = l;
      }
      if (times >= 1) {
        return [true, l, c];
      }
      return [false, left, collected];
    };

    return OneOrMore;

  })(Pattern);

  Either = (function(_super) {

    __extends(Either, _super);

    function Either() {
      return Either.__super__.constructor.apply(this, arguments);
    }

    Either.prototype.match = function(left, collected) {
      var outcome, outcomes, p, _i, _len, _ref;
      if (collected == null) {
        collected = [];
      }
      outcomes = [];
      _ref = this.children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        p = _ref[_i];
        outcome = p.match(left, collected);
        if (outcome[0]) {
          outcomes.push(outcome);
        }
      }
      if (outcomes.length > 0) {
        outcomes.sort(function(a, b) {
          if (a[1].length > b[1].length) {
            return 1;
          } else if (a[1].length < b[1].length) {
            return -1;
          } else {
            return 0;
          }
        });
        return outcomes[0];
      }
      return [false, left, collected];
    };

    return Either;

  })(Pattern);

  TokenStream = (function(_super) {

    __extends(TokenStream, _super);

    function TokenStream(source, error) {
      var stream;
      this.error = error;
      stream = source.constructor === String ? source.replace(/^\s+|\s+$/, '').split(/\s+/) : source;
      this.push.apply(this, stream);
    }

    TokenStream.prototype.shift = function() {
      return [].shift.apply(this) || null;
    };

    TokenStream.prototype.current = function() {
      return this[0] || null;
    };

    TokenStream.prototype.toString = function() {
      return ([].slice.apply(this)).toString();
    };

    TokenStream.prototype.join = function(glue) {
      return [].join.apply(this, glue);
    };

    return TokenStream;

  })(Array);

  parse_shorts = function(tokens, options) {
    var o, opt, parsed, raw, value, _ref;
    raw = tokens.shift().slice(1);
    parsed = [];
    while (raw.length > 0) {
      opt = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = options.length; _i < _len; _i++) {
          o = options[_i];
          if (o.shortopt !== null && o.shortopt[1] === raw[0]) {
            _results.push(o);
          }
        }
        return _results;
      })();
      if (opt.length > 1) {
        tokens.error("-" + raw[0] + " is specified ambiguously " + opt.length + " times");
      }
      if (opt.length < 1) {
        if (tokens.error === DocoptExit) {
          throw new tokens.error("-" + raw[0] + " is not recognized");
        } else {
          o = new Option('-' + raw[0], null);
          options.push(o);
          parsed.push(o);
          raw = raw.slice(1);
          continue;
        }
      }
      o = opt[0];
      opt = new Option(o.shortopt, o.longopt, o.argcount, o.value);
      raw = raw.slice(1);
      if (opt.argcount === 0) {
        value = true;
      } else {
        if (raw === '' || raw === null) {
          if (tokens.current() === null) {
            throw new tokens.error("-" + opt.shortopt[0] + " requires argument");
          }
          raw = tokens.shift();
        }
        _ref = [raw, ''], value = _ref[0], raw = _ref[1];
      }
      opt.value = value;
      parsed.push(opt);
    }
    return parsed;
  };

  parse_long = function(tokens, options) {
    var o, opt, raw, value, _, _ref, _ref1;
    _ref1 = (_ref = tokens.current().match(/(.*?)=(.*)/)) != null ? _ref : [null, tokens.current(), ''], _ = _ref1[0], raw = _ref1[1], value = _ref1[2];
    tokens.shift();
    value = value === '' ? null : value;
    opt = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = options.length; _i < _len; _i++) {
        o = options[_i];
        if (o.longopt && o.longopt.slice(0, raw.length) === raw) {
          _results.push(o);
        }
      }
      return _results;
    })();
    if (opt.length > 1) {
      throw new tokens.error("" + raw + " is specified ambiguously " + opt.length + " times");
    }
    if (opt.length < 1) {
      if (tokens.error === DocoptExit) {
        throw new tokens.error("" + raw + " is not recognized");
      } else {
        o = new Option(null, raw, +(!!value));
        options.push(o);
        return [o];
      }
    }
    o = opt[0];
    opt = new Option(o.shortopt, o.longopt, o.argcount, o.value);
    if (opt.argcount === 1) {
      if (value === null) {
        if (tokens.current() === null) {
          tokens.error("" + (opt.name()) + " requires argument");
        }
        value = tokens.shift();
      }
    } else if (value === !null) {
      tokens.error("" + (opt.name()) + " must not have an argument");
    }
    opt.value = value || true;
    return [opt];
  };

  parse_pattern = function(source, options) {
    var result, tokens;
    tokens = new TokenStream(source.replace(/([\[\]\(\)\|]|\.\.\.)/g, ' $1 '), DocoptLanguageError);
    result = parse_expr(tokens, options);
    if (tokens.current() === !null) {
      raise(tokens.error('unexpected ending: ' + tokens.join(' ')));
    }
    return new Required(result);
  };

  parse_expr = function(tokens, options) {
    var result, seq;
    seq = parse_seq(tokens, options);
    if (tokens.current() !== '|') {
      return seq;
    }
    result = seq.length > 1 ? [new Required(seq)] : seq;
    while (tokens.current() === '|') {
      tokens.shift();
      seq = parse_seq(tokens, options);
      result = result.concat(seq.length > 1 ? [new Required(seq)] : seq);
    }
    if (result.length > 1) {
      return [new Either(result)];
    } else {
      return result;
    }
  };

  parse_seq = function(tokens, options) {
    var atom, result, _ref;
    result = [];
    while ((_ref = tokens.current()) !== null && _ref !== ']' && _ref !== ')' && _ref !== '|') {
      atom = parse_atom(tokens, options);
      if (tokens.current() === '...') {
        atom = [new OneOrMore(atom)];
        tokens.shift();
      }
      result = result.concat(atom);
    }
    return result;
  };

  parse_atom = function(tokens, options) {
    var result, token;
    token = tokens.current();
    result = [];
    if (token === '(') {
      tokens.shift();
      result = [new Required(parse_expr(tokens, options))];
      if (tokens.shift() !== ')') {
        raise(tokens.error("Unmatched '('"));
      }
      return result;
    } else if (token === '[') {
      tokens.shift();
      if (tokens.current() === 'options') {
        result = [new Optional([new AnyOptions])];
        tokens.shift();
      } else {
        result = [new Optional(parse_expr(tokens, options))];
      }
      if (tokens.shift() !== ']') {
        raise(tokens.error("Unmatched '['"));
      }
      return result;
    } else if (token.slice(0, 2) === '--') {
      if (token === '--') {
        return [new Command(tokens.shift())];
      } else {
        return parse_long(tokens, options);
      }
    } else if (token[0] === '-' && token !== '-') {
      return parse_shorts(tokens, options);
    } else if ((token[0] === '<' && token[token.length - 1] === '>') || /^[^a-z]*[A-Z]+[^a-z]*$/.test(token)) {
      return [new Argument(tokens.shift())];
    } else {
      return [new Command(tokens.shift())];
    }
  };

  parse_args = function(source, options) {
    var longs, opts, shorts, token, tokens;
    tokens = new TokenStream(source, DocoptExit);
    opts = [];
    while ((token = tokens.current()) !== null) {
      if (!(token instanceof String || typeof token === 'string')) {
        opts.push(new Argument(null, tokens.shift()));
      } else if (token === '--') {
        return opts.concat((function() {
          var _results;
          _results = [];
          while (tokens.length) {
            _results.push(new Argument(null, tokens.shift()));
          }
          return _results;
        })());
      } else if (token.slice(0, 2) === '--') {
        longs = parse_long(tokens, options);
        opts = opts.concat(longs);
      } else if (token[0] === '-' && token !== '-') {
        shorts = parse_shorts(tokens, options);
        opts = opts.concat(shorts);
      } else {
        //opts.push(new Argument(null, tokens.shift()));
        // options_first is the default choice
        // I have no idea what this does. Monkey see python, monkey do JS.
        // Monkey not even refactor.
        return opts.concat((function() {
          var _results;
          _results = [];
          while (tokens.length) {
            _results.push(new Argument(null, tokens.shift()));
          }
          return _results;
        })());
      }
    }
    return opts;
  };

  parse_doc_options = function(doc) {
    var s, _i, _len, _ref, _results;
    _ref = doc.split(/^ *-|\n *-/).slice(1);
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      s = _ref[_i];
      _results.push(Option.parse('-' + s));
    }
    return _results;
  };

  printable_usage = function(doc, name) {
    var usage_split;
    usage_split = doc.split(/(usage:)/i);
    if (usage_split.length < 3) {
      throw new DocoptLanguageError('"usage:" (case-insensitive) not found.');
    } else if (usage_split.length > 3) {
      throw new DocoptLanguageError('More than one "usage:" (case-insensitive).');
    }
    return usage_split.slice(1).join('').split(/\n\s*\n/)[0].replace(/^\s+|\s+$/, '');
  };

  formal_usage = function(printable_usage) {
    var pu, s;
    pu = printable_usage.split(/\s+/).slice(1);
    return ((function() {
      var _i, _len, _ref, _results;
      _ref = pu.slice(1);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        s = _ref[_i];
        _results.push(s === pu[0] ? '|' : s);
      }
      return _results;
    })()).join(' ');
  };

  extras = function(help, version, options, doc) {
    var opt, opts, _i, _len;
    opts = {};
    for (_i = 0, _len = options.length; _i < _len; _i++) {
      opt = options[_i];
      if (opt.value) {
        opts[opt.name()] = true;
      }
    }
    if (help && (opts['--help'] || opts['-h'])) {
      error = doc.replace(/^\s*|\s*$/, '');
      return;
    }
    if (version && opts['--version']) {
      error = version;
    }
  };

  Dict = (function(_super) {

    __extends(Dict, _super);

    function Dict(pairs) {
      var key, value, _i, _len, _ref;
      for (_i = 0, _len = pairs.length; _i < _len; _i++) {
        _ref = pairs[_i], key = _ref[0], value = _ref[1];
        this[key] = value;
      }
    }

    Dict.prototype.toString = function() {
      var atts, k;
      atts = (function() {
        var _results;
        _results = [];
        for (k in this) {
          if (k !== 'constructor' && k !== 'toString') {
            _results.push(k);
          }
        }
        return _results;
      }).call(this);
      atts.sort();
      return '{' + ((function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = atts.length; _i < _len; _i++) {
          k = atts[_i];
          _results.push(k + ': ' + this[k]);
        }
        return _results;
      }).call(this)).join(',\n ') + '}';
    };

    return Dict;

  })(Object);

  docopt = function(doc, kwargs, print_doc) {
    var a, allowedargs, arg, argums, argv, formal_pattern, help, left, matched, name, opt, options, parameters, pot_arguments, pot_options, usage, version, _ref;
    if (kwargs == null) {
      kwargs = {};
    }
    error = null;
    allowedargs = ['argv', 'name', 'help', 'version'];
    for (arg in kwargs) {
      if (__indexOf.call(allowedargs, arg) < 0) {
        throw new Error("unrecognized argument to docopt: ");
      }
    }
    argv = kwargs.argv === void 0 ? [] : kwargs.argv;
    name = kwargs.name === void 0 ? null : kwargs.name;
    help = kwargs.help === void 0 ? true : kwargs.help;
    version = kwargs.version === void 0 ? null : kwargs.version;
    try {
      usage = printable_usage(doc, name);
      pot_options = parse_doc_options(doc);
      formal_pattern = parse_pattern(formal_usage(usage), pot_options);
      argv = parse_args(argv, pot_options);
      extras(help, version, argv, doc);
      _ref = formal_pattern.fix().match(argv), matched = _ref[0], left = _ref[1], argums = _ref[2];
      if (matched && left.length === 0) {
        options = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = argv.length; _i < _len; _i++) {
            opt = argv[_i];
            if (opt.constructor === Option) {
              _results.push(opt);
            }
          }
          return _results;
        })();
        pot_arguments = (function() {
          var _i, _len, _ref1, _ref2, _results;
          _ref1 = formal_pattern.flat();
          _results = [];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            a = _ref1[_i];
            if ((_ref2 = a.constructor) === Argument || _ref2 === Command) {
              _results.push(a);
            }
          }
          return _results;
        })();
        parameters = [].concat(pot_options, options, pot_arguments, argums);
        return [
          error, new Dict((function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = parameters.length; _i < _len; _i++) {
              a = parameters[_i];
              _results.push([a.name(), a.value]);
            }
            return _results;
          })())
        ];
      }
      return [printable_usage(print_doc), {}];
    } catch (err) {
      return [error, {}];
    }
  };
  return docopt;
}();
