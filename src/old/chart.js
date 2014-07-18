function Chart(opts) {
    var self = this;

    Chart.base.call(self);
    self.opts = opts;
    self.data = {};
    self.colors = [
        '#1f77b4',
        '#ff7f0e',
        '#2ca02c',
        '#d62728',
        '#9467bd',
        '#8c564b',
        '#e377c2',
        '#7f7f7f',
        '#bcbd22',
        '#17becf',
        '#aec7e8',
        '#ffbb78',
        '#98df8a',
        '#ff9896',
        '#c5b0d5',
        '#c49c94',
        '#f7b6d2',
        '#c7c7c7',
        '#dbdb8d',
        '#9edae5'
    ];
    self.no_data = 'Not Available';
    self.isNumericData = true;
}

inherit(Chart, Command);

Chart.prototype.usage = 'chart        -- generate chart\n\n' +
    'Usage:\n' +
    '    chart -e <exp> [-t <title>] [-T <type>] [-b <buckets>] [-H <height>] [<file>...]\n' +
    '    chart -f <field> [-t <title>] [-T <type>] [-b <buckets>] [-H <height>] [<file>...]\n' +
    '    chart -h | --help\n\n' +
    'Options:\n' +
    '    -h --help              Show this message.\n' +
    '    -e <exp>               Chart <exp> of all input objects where' +
    ' <exp> is a Javascript expression\n' +
    '    -f <field>             Chart field of object\n' +
    '    -t <title>             Title to use for chart\n' +
    '    -T <type>              Type of chart - auto, pie or bar [default: auto]\n' +
    '    -H <height>            Height of chart in pixels [default: 450]\n' + 
    '    -b <buckets>           Number of buckets [default: 10]\n';

Chart.prototype.next = check_next(do_docopt(fileargs(function() {
    var self = this,
        exp = self.docopts['-e'],
        field = self.docopts['-f'];
    self.label = self.docopts['-t'] || beautify(self.docopts['-f']) || 'Chart';
    self.height = Math.min(Math.max(parseInt(self.docopts['-H'], 10), 150), 450);
    self.type = self.docopts['-T'];
    self.numBuckets = parseInt(self.docopts['-b'], 10);
    if (isNaN(self.numBuckets) || self.numBuckets < 1) {
        self.numBuckets = 10;
    }
    self.width = Math.max(self.height * 1.5, 300);
    if (self.inited === undefined) {
        self.inited = true;
        if (exp) {
            self.getfield = eval_getexp(exp);
        } else if (field) {
            self.getfield = eval_getfield(field, undefined);
        }
        if (isstring(self.getfield)) {
            return self.exit(self.getfield);
        }
    }

    next();
    function next() {
        self.unext({}, cef(self, process_item));
    }

    function process_item(item) {
        if (item === null) {
            self.done = true;
            var usePie = false;
            var chartfn = self.bar.bind(self);
            var comparefn = function(x, y) {
                var a = parseFloat(x[0]),
                    b = parseFloat(y[0]);
                return (a < b) ? -1 : ((a > b) ? 1 : 0);
            };
            for (var i in self.data) {
                if (!isnumber(i) && i !== self.no_data) {
                    usePie = true;
                    self.isNumericData = false;
                }
            }
            if (self.type === 'bar') {
                usePie = false;
            }
            if (self.type === 'pie') {
                usePie = true;
            }
            if (usePie) {
                chartfn = self.pie.bind(self);
                comparefn = function(a, b) {
                    return (a.label < b.label) ? -1 :
                        ((a.label > b.label) ? 1 : 0);
                };
                self.data = $.map(self.data, function(val, index) {
                    return {
                        label: beautify(index),
                        data: val
                    };
                });
            } else {
                // remove not available data from bar chart
                var na = self.data[self.no_data];
                delete self.data[self.no_data];
                self.data = $.map(self.data, function(val, index) {
                    return [[index, val]];
                });
                self.data.sort(comparefn);
                // bucket only if possible
                if (self.isNumericData) {
                    self.data = bucket(self.data, self.numBuckets);
                }
                if (na && self.data.length > 1) {
                    var width = self.data[1][0] - self.data[0][0];
                    self.data.unshift([self.data[0][0] - width, na]);
                    self.na = true;
                }

            }
            self.div = $('<div style="width: ' +
                self.width +
                'px; height: ' +
                self.height +
                'px"><div style="width: ' +
                self.width +
                'px; height: ' +
                self.height * 0.1 +
                'px"><h3 class="title">' +
                self.label +
                '</h3></div></div>').appendTo($('body'));
            self.innerdiv = $('<div style="width: ' +
                self.width +
                'px; height: ' +
                self.height * 0.9 +
                'px"/>').appendTo(self.div);
            chartfn();
            html2canvas(self.div, {
                onrendered: function(canvas) {
                    self.div.empty().remove();
                    self.done = true;
                    return self.output(canvas);
                },
                proxy: '',
                useCORS: true,
                allowTaint: true
            });
        } else {
            try {
                var n = self.getfield(item);
                if (n === undefined || n === null || n === '') {
                    n = self.no_data;
                }
                if (self.data[n] === undefined) {
                    self.data[n] = 1;
                } else {
                    self.data[n]++;
                }
            } catch(err) {
                self.errmsg('Caught error: ' + err.message);
            }

            next();
        }
    }
})));

Chart.prototype.bar = function() {
    var self = this,
        width = 1,
        ticks = null;
    if (self.isNumericData) {
        width = self.data.length > 1 ? self.data[1][0] - self.data[0][0]: 1;
        ticks = self.data.map(function(val) {
            return [val[0], parseInt(val[0], 10)];
        });
        if (self.na === true) {
            ticks[0] = [ticks[0][0], "NA"];
        }
    }

    $.plot(self.innerdiv, [{
            data: self.data,
            bars: {
                show: true,
                barWidth: width,
                align: "center"
            }
        }],
        {
            legend: { show: false },
            colors: self.colors,
            xaxis: {
                ticks: ticks
            }
        }
    );
};

Chart.prototype.pie = function() {
    var self = this;
    $.plot(self.innerdiv, self.data,
    {
        series: {
            pie: { 
                show: true,
                radius: 1,
                label: {
                    show: true,
                    radius: 3/4,
                    formatter: function(label, series) {
                        return '<div style="font-size:8pt;' +
                            'text-align:center;padding:2px;' +
                            'color:black;">' +
                            series.data[0][1] +
                            '</div>';
                    },
                    background: { opacity: 0 }
                }
            }
        },
        legend: {
            show: true,
            backgroundOpacity: 0,
            noColumns: Math.floor(self.data.length/20) + 1
        },
        colors: self.colors
    });
};

Command.register("chart", Chart);
