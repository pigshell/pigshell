/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Chart(opts) {
    var self = this;

    Chart.base.call(self, opts);
}

inherit(Chart, Command);
Chart.scripts = ["http://pigshell.com/common/d3.v3/d3.v3.min.js"];

Chart.prototype.usage = 'chart        -- generate chart\n\n' +
    'Usage:\n' +
    '    chart -t <type> [-l] [-o <opts>] [<obj>...]\n' +
    '    chart -l\n' +
    '    chart -h | --help\n\n' +
    'Options:\n' +
    '    -h --help              Show this message.\n' +
    '    -t <type>              Type of chart: bar, pie, etc.\n' +
    '    -l                     List available charts or options of given chart\n' +
    '    -o <opts>              Chart opts.\n';

Chart.chart_list = {};

Chart.register = function(name, handler) {
    Chart.chart_list[name] = handler;
};

Chart.unregister = function(name) {
    delete Chart.chart_list[name];
};

Chart.lookup = function(name) {
    return Chart.chart_list[name];
};

Chart.list = function() {
    return Object.keys(Chart.chart_list);
};

Chart.prototype.next = check_next(loadscripts(do_docopt(objargs(function(opts, cb) {
    var self = this,
        ctype = self.docopts['-t'],
        cliopts = optstr_parse(self.docopts['-o'], true),
        sink = [];

    if (!ctype && self.docopts['-l']) {
        self.done = true;
        return self.output(Chart.list().join('\n'));
    }

    var chart = Chart.lookup(ctype);
    if (!chart) {
        return self.exit("No such chart type");
    }
    
    if (self.docopts['-l']) {
        cliopts.list = true;
        chart(null, self.pterm(), cliopts, function(err, res) {
            if (err) {
                return self.exit(err);
            }
            self.done = true;
            delete res['list'];
            return self.output(JSON.stringify(res, null, "    "));
        });
        return;
    }
    next();
    function next() {
        self.unext({}, cef(self, function(item) {
            if (item !== null) {
                sink.push(item);
                return next();
            }
            chart(sink, self.pterm(), cliopts, function(err, res) {
                if (err) {
                    return self.exit(err);
                }
                if (isatty(opts.term)) {
                    self.done = true; 
                    return self.output({html: res});
                } else {
                    svgtocanvas(res);
                }
            });
        }));
    }

    function svgtocanvas(svg) {
        var xmldoc = (new window.XMLSerializer()).serializeToString(svg);
        var width = svg.getAttribute("width") || 800,
            height = svg.getAttribute("height") || 600;
        to('canvas', xmldoc, {width: width, height: height}, function(err, res) {
            if (err) {
                return self.exit(err_stringify(err));
            }
            self.done = true;
            self.output(res);
        });
    }
}))));

Command.register("chart", Chart);

/*
 * SVG elements can use CSS when rendered normally in the document, but we
 * often want to render it to a canvas, so that it can be exported as a PNG.
 * In such cases, CSS styles are not automatically inlined by the serializer.
 *
 * This means we have to "manually" apply styles to individual SVG elements.
 * To keep things at least somewhat DRY, we declare CSS-esque property lists
 * for each chart and apply them using the .style() method.
 *
 * This is a headache, but one positive side-effect is that individual styles
 * can be manipulated with CLI options.
 * For instance: chart -t vertbar -o css.databar.fill="steelblue"
 */

function style(css) {
    var args = [].slice.call(arguments, 1);
    args = args.map(function(d) { return css[d] || {}; });
    args.unshift({});
    return $.extend.apply($, args);
}

/*
 * Vertical bar chart
 *
 * cat http://pigshell.com/sample/gdp-ppp.html | to text | jf '$$.html($$(x).find("table").first())' | table2js -e "tr" foo key data | jf 'x.data = Math.round(+x.data.replace(/,/g,"")) / 1000, x' | chart -t vertbar
 */

function vertbar(data, term, opts, cb) {
    var tw = term ? term.div.width() : 800;
    var defaults = {
        width: d3.min([800, tw]),
        key: 'key',
        field: 'data',
        xtformat: ',.0f',
        margin: {top: 50, right: 20, bottom: 20, left: 20},
        barheight: 20,
        title: '',
        css: {
            'body': { 'font-family': 'sans-serif', 'font-size': '10px',
                'background': '#fff'},
            'rect': { 'stroke': '#fff', 'shape-rendering': 'crispEdges' },
            'databar': { 'fill': 'rgb(158, 202, 225)' },
            'background': { 'fill': '#eee' },
            'bartext': { 'font-size': '12px', 'fill': '#333' },
            'axis': { 'fill': 'none', 'stroke': '#000', 'shape-rendering': 'crispEdges' },
            'title': { 'font-size': '18px', 'font-weight': 'bold' }
        }
    };

    opts = $.extend(true, {}, defaults, opts);
    if (opts.list) {
        return cb(null, opts);
    }

    data = data.map(function(d) {
        var key = d[opts.key] ? d[opts.key].toString().trim() : null,
            val = (d[opts.field] !== undefined && isNaN(+d[opts.field])) ? null : +d[opts.field];
        return (key === null || val === null) ? null : {key: key, value: val};
    });
    data = data.filter(function(d) { return d !== null; });
    var values = data.map(function(d) { return d.value; });
    var margin = opts.margin,
        bheight = opts.barheight,
        width = opts.width - margin.left - margin.right;

    var x = d3.scale.linear()
        .domain([0, d3.max(values)])
        .range([0, width]);

    var y = d3.scale.ordinal()
        .domain(d3.range(data.length))
        .rangeBands([0, data.length * bheight]);

    var height = y.rangeExtent()[1];

    var xAxis = d3.svg.axis()
        .scale(x)
        .tickFormat(d3.format(opts.xtformat));

    var _svg = document.createElementNS(d3.ns.prefix.svg, 'svg'),
        svg = d3.select(_svg)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style(style(opts.css, 'body'))
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append('g')
        .attr('class', 'x axis top')
        .call(xAxis.orient('top'));

    svg.append('g')
        .attr('class', 'x axis bottom')
        .attr('transform', 'translate(0,' + height + ')')
        .call(xAxis.orient('bottom'));

    d3.selectAll(_svg.querySelectorAll('.axis path, .axis line'))
        .style(style(opts.css, "axis"));

    var bar = svg.selectAll(".bar")
        .data(data)
      .enter().append("g")
        .attr("class", "bar")
        .attr("transform", function(d, i) { return "translate(0," + y(i) + ")"; });

    bar.append("rect")
        .attr("class", "background")
        .style(style(opts.css, 'rect', 'background'))
        .attr("width", width)
        .attr("height", y.rangeBand());

    bar.append("rect")
        .attr("class", "databar")
        .style(style(opts.css, 'rect', 'databar'))
        .attr("width", function(d) { return x(d.value); })
        .attr("height", y.rangeBand());

    bar.append("text")
        .attr('y', y.rangeBand() - 5)
        .style(style(opts.css, 'bartext'))
        .attr("x", 5)
        .text(function(d) { return d.key; });

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -25)
        .attr("text-anchor", "middle")
        .attr("class", "title")
        .style(style(opts.css, 'title'))
        .text(opts.title);

    return cb(null, _svg);
}

Chart.register("vertbar", vertbar);

/*
 * Histogram
 * Based on http://bl.ocks.org/mbostock/3048450 
 * cat http://pigshell.com/sample/gdp-ppp.html | to text | jf '$$.html($$(x).find("table").first())' | table2js -e "tr" foo key data | jf 'x.data = Math.round(+x.data.replace(/,/g,"")) / 1000, x' | chart -t histogram
 */

function histogram(idata, term, opts, cb) {
    var tw = term ? term.div.width() : 800,
        defw = d3.min([800, tw]),
        aspect = 16 / 9;

    var defaults = {
        width: defw,
        field: 'data',
        xtformat: '.0f',
        xmin: 0,
        xmax: 'max',
        margin: {top: 20, right: 20, bottom: 50, left: 20},
        bins: 20,
        height: defw / aspect,
        title: '',
        css: {
            'body': { 'font-family': 'sans-serif', 'font-size': '10px',
                'background': '#fff' },
            'databar': { 'fill': 'steelblue', 'shape-rendering': 'crispEdges' },
            'bartext': { 'fill': 'steelblue' },
            'axis': { 'fill': 'none', 'stroke': '#000', 'shape-rendering': 'crispEdges' },
            'title': { 'font-size': '18px', 'font-weight': 'bold' }
        }
    };

    if (opts.width && !opts.height) {
        opts.height = opts.width / aspect;
    } else if (opts.height && !opts.width) {
        opts.width = opts.height * aspect;
    }
    opts = $.extend(true, {}, defaults, opts);
    if (opts.list) {
        return cb(null, opts);
    }

    idata = idata.map(function(d) {
        var val = (d[opts.field] !== undefined && !isNaN(+d[opts.field])) ? +d[opts.field] : null;
        return val;
    });
    var values = idata.filter(function(d) { return d !== undefined && d !== null; });

    var formatCount = d3.format(',.0f');

    var margin = opts.margin,
        width = opts.width - margin.left - margin.right,
        height = opts.height - margin.top - margin.bottom;

    var xmin = (opts.xmin === 'min') ? d3.min(values) : opts.xmin,
        xmax = (opts.xmax === 'max') ? d3.max(values) : opts.xmax,
        x = d3.scale.linear()
            .domain([xmin, xmax])
            .range([0, width]);

    var data = d3.layout.histogram()
        .bins(x.ticks(opts.bins))
        (values);

    var y = d3.scale.linear()
            .domain([0, d3.max(data, function(d) { return d.y; })])
            .range([height, 0]);

    var xAxis = d3.svg.axis()
            .scale(x)
            .tickFormat(d3.format(opts.xtformat))
            .orient("bottom");

    var _svg = document.createElementNS(d3.ns.prefix.svg, 'svg'),
        svg = d3.select(_svg)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .style(style(opts.css, 'body'))
        .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var bar = svg.selectAll(".bar")
            .data(data)
        .enter().append("g")
            .attr("class", "bar")
            .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

    var bwidth = x(data[1].x) - x(data[0].x) - 2;
    bar.append("rect")
        .style(style(opts.css, "databar"))
        .attr("x", 2)
        .attr("width", bwidth)
        .attr("height", function(d) { return height - y(d.y); });

    bar.append("text")
        .style(style(opts.css, "bartext"))
        .attr("dy", ".75em")
        .attr("y", -10)
        .attr("x", x(data[0].x + data[0].dx) / 2)
        .attr("text-anchor", "middle")
        .text(function(d) { return d.y ? formatCount(d.y) : ''; });

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    d3.selectAll(_svg.querySelectorAll('.axis path, .axis line'))
        .style(style(opts.css, "axis"));

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 35)
        .attr("text-anchor", "middle")
        .attr("class", "title")
        .style(style(opts.css, "title"))
        .text(opts.title);

    return cb(null, _svg);
}

Chart.register("histogram", histogram);

/*
 * Pie chart
 *
 * ls /facebook/friends/ | chart -t pie -o title="Gender Distribution",field=gender,height=150
 */

function pie(idata, term, opts, cb) {
    var tw = term ? term.div.width() : 800,
        defw = d3.min([800, tw]),
        aspect = 16 / 9,
        defaults = {
            width: defw,
            field: 'data',
            format: ',.0f',
            margin: {top: 30, right: 20, bottom: 20, left: 20},
            height: defw / aspect,
            title: '',
            css: {
                'body': { 'font-family': 'sans-serif', 'font-size': '12px',
                    'background': '#fff' },
                'title': { 'font-size': '18px', 'font-weight': 'bold' }
            }
        };

    if (opts.width && !opts.height) {
        opts.height = opts.width / aspect;
    } else if (opts.height && !opts.width) {
        opts.width = opts.height * aspect;
    }
    opts = $.extend(true, {}, defaults, opts);
    if (opts.list) {
        return cb(null, opts);
    }
    
    var data = d3.nest()
      .key(function(d) { return d[opts.field] ? d[opts.field].toString() : 'NA'; })
      .rollup(function(d) { return d.length; })
      .entries(idata);

    var color = d3.scale.category20();

    var margin = opts.margin,
        width = opts.width - margin.left - margin.right,
        height = opts.height - margin.top - margin.bottom;

    var radius = height / 2,
        arc = d3.svg.arc()
            .outerRadius(radius - 10)
            .innerRadius(0);

    var pie = d3.layout.pie()
            .sort(null)
            .value(function(d) { return d.values; });

    var _svg = document.createElementNS(d3.ns.prefix.svg, 'svg'),
        svg = d3.select(_svg)
            .attr("width", opts.width)
            .attr("height", opts.height)
            .style(style(opts.css, "body"))
        .append("g")
            .attr("transform", "translate(" + (margin.left + height / 2) + "," + (margin.top + height / 2) + ")");

    var g = svg.selectAll(".arc")
            .data(pie(data))
        .enter().append("g")
            .attr("class", "arc");

    g.append("path")
        .attr("d", arc)
        .style("stroke", "#fff")
        .style("fill", function(d, i) { return color(i); });

    g.append("text")
        .attr("transform", function(d) {
            return "translate(" + arc.centroid(d) + ")"; })
        .attr("dy", ".35em")
        .style("text-anchor", "middle")
        .text(function(d) { return d.value; });

    var legend = svg.append("g")
            .attr("height", height)
            .attr("width", 10 / 9 * height)
            .attr("transform", "translate(" + height / 2+ "," +
                (- height / 2 + 20) + ")");

    legend.selectAll("rect")
        .data(data)
    .enter().append("rect")
        .attr("x", 0)
        .attr("y", function(d, i) { return i * 20; })
        .attr("width", 10)
        .attr("height", 10)
        .style("fill", function(d, i) { return color(i); });
        
    legend.selectAll("text")
        .data(data)
    .enter().append("text")
        .attr("x", 20)
        .attr("y", function(d, i) { return i * 20 + 9; })
        .text(function(d) { return d.key; });

    svg.append("text")
        .attr("x", width / 2 - height / 2)
        .attr("y", -height / 2 - 10)
        .attr("text-anchor", "middle")
        .attr("class", "title")
        .style(style(opts.css, "title"))
        .text(opts.title);

    return cb(null, _svg);
}
Chart.register("pie", pie);

/*
 * Time series
 * Based on http://bl.ocks.org/mbostock/3884955 
 *
 * cat "http://quandl.com/api/v1/multisets.csv?columns=ODA.IND_NGDPD.1,ODA.PAK_NGDPD.1,ODA.CHN_NGDPD.1,ODA.USA_NGDPD.1&trim_end=2013-12-31" | csv2js | chart -t tseries -o title="GDP (billion dollars)"
 */

function tseries(data, term, opts, cb) {
    var tw = term ? term.div.width() : 800,
        defw = d3.min([800, tw]),
        aspect = 16 / 9;

    var defaults = {
        width: defw,
        tfield: 'Date',
        tformat: 'auto',
        xtitle: '',
        ytitle: '',
        title: '',
        margin: {top: 40, right: 70, bottom: 40, left: 50},
        height: defw / aspect,
        css: {
            'body': { 'font-family': 'sans-serif', 'font-size': '12px',
                'background': '#fff' },
            'axis': { 'fill': 'none', 'stroke': '#000', 'shape-rendering': 'crispEdges' },
            'grid': { 'fill': 'none', 'stroke': '#ccc', 'shape-rendering': 'crispEdges', 'opacity': '0.7' },
            'line': { 'fill': 'none', 'stroke-width': '1.5px' },
            'title': { 'font-size': '18px', 'font-weight': 'bold' }
        }
    };

    if (opts.width && !opts.height) {
        opts.height = opts.width / aspect;
    } else if (opts.height && !opts.width) {
        opts.width = opts.height * aspect;
    }
    opts = $.extend({}, defaults, opts);
    if (opts.list) {
        return cb(null, opts);
    }

    var margin = opts.margin,
        bheight = opts.barheight,
        width = opts.width - margin.left - margin.right,
        height = opts.height - margin.top - margin.bottom;

    var parseDate;
    if (opts.tformat === 'auto') {
        parseDate = function(str) {
            var d = Date.parse(str);
            return isNaN(d) ? null : new Date(d);
        };
    } else {
        parseDate = d3.time.format(opts.tformat).parse;
    }

    var x = d3.time.scale().range([0, width]),
        y = d3.scale.linear().range([height, 0]),
        color = d3.scale.category10();

    var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom");

    var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left");

    var line = d3.svg.line()
            .interpolate("basis")
            .x(function(d) { return x(d.date); })
            .y(function(d) { return y(d.data); });

    var _svg = document.createElementNS(d3.ns.prefix.svg, 'svg'),
        svg = d3.select(_svg)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .style(style(opts.css, "body"))
        .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    color.domain(d3.keys(data[0]).filter(function(key) { return key !== opts.tfield; }));

    data.forEach(function(d) {
        d.date = parseDate(d[opts.tfield]);
    });
    data = data.filter(function(d) { return d.date !== null; });
    data = data.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

    var cities = color.domain().map(function(name) {
        return {
            name: name,
            values: data.map(function(d) {
                return isNaN(+d[name]) ? null : {date: d.date, data: +d[name]};
            }).filter(function(d) { return d !== null; })
        };
    });

    x.domain(d3.extent(data, function(d) { return d.date; }));

    y.domain([
        d3.min(cities, function(c) { return d3.min(c.values, function(v) { return v.data; }); }),
        d3.max(cities, function(c) { return d3.max(c.values, function(v) { return v.data; }); })
    ]);

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
    .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(opts.ytitle);

    var ygrid = d3.svg.axis()
        .scale(y)
        .orient("left")
        .tickSize(-width)
        .tickFormat("");

    var xgrid = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickSize(-height)
        .tickFormat("");

    svg.append("g")
        .attr("class", "grid")
        .call(ygrid);

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .attr("class", "grid")
        .call(xgrid);

    d3.selectAll(_svg.querySelectorAll('.axis path, .axis line'))
        .style(style(opts.css, "axis"));

    d3.selectAll(_svg.querySelectorAll('.grid path, .grid line'))
        .style(style(opts.css, "grid"));

    var city = svg.selectAll(".city")
        .data(cities)
    .enter().append("g")
        .attr("class", "city");

    city.append("path")
        .attr("class", "line")
        .attr("d", function(d) { return line(d.values); })
        .style(style(opts.css, "line"))
        .style("stroke", function(d) { return color(d.name); });

    city.append("text")
        .datum(function(d) { return {name: d.name, value: d.values[d.values.length - 1]}; })
        .attr("transform", function(d) { return "translate(" + x(d.value.date) + "," + y(d.value.data) + ")"; })
        .attr("x", 3)
        .attr("dy", ".35em")
        .text(function(d) { return d.name; });

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("class", "title")
        .style(style(opts.css, 'title'))
        .text(opts.title);

    return cb(null, _svg);
}
Chart.register("tseries", tseries);
