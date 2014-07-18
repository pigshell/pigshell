/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function PixasticProcess(opts) {
    var self = this;

    PixasticProcess.base.call(self, opts);
    self.processMap = { '-d': ['desaturate'],
                        '-l': ['laplace', {edgeStrength:3.0,invert:false,greyLevel:0}],
                        '-b': ['blurfast', {amount:0.5}],
                        '-c': ['colorhistogram', {paint:true}]
    };
}

inherit(PixasticProcess, Command);

PixasticProcess.scripts = ["extra/pixastic.custom.js"];

PixasticProcess.prototype.usage = 'pixastic     -- image processing\n\n' +
    'Usage:\n' +
    '    pixastic [-h | --help]\n' +
    '    pixastic [-dlbc]\n';

PixasticProcess.prototype.next = check_next(loadscripts(do_docopt(function() {
    var self = this;

    self.unext({}, cef(self, function(file) {
        var canvas;

        if (file === null) {
            return self.exit();
        }

        canvas = file;
        if (canvas.constructor === HTMLCanvasElement) {
            for (var key in self.docopts) {
                if (self.docopts[key] && self.processMap.hasOwnProperty(key)) {
                    if (self.processMap[key].length > 1) {
                        canvas = Pixastic.process(canvas,
                            self.processMap[key][0], self.processMap[key][1]);
                    } else {
                        canvas = Pixastic.process(canvas,
                            self.processMap[key][0]);
                    }
                }
            }
            if (canvas) {
                return self.output(canvas);
            } else {
                self.errmsg('Pixastic processing failed');
                self.output(file);
            }
        } else {
            self.errmsg('Object is not a canvas');
            self.output(file);
        }
    }));
})));

Command.register("pixastic", PixasticProcess);
