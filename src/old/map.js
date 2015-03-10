/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Map(opts) {
    var self = this;

    Map.base.call(self, opts);
    self.markers = {};
    self.mapId = 'map_' + Math.random().toString(36)
        .substring(2).replace(/[0-9]/g, "A");
    self.div = null;
    self.inited = false;
    self.data = false;
}

inherit(Map, Command);

Map.prototype.usage = 'map          -- plot files with location data on a map\n\n' +
    'Usage:\n' +
    '    map [-c <css>] [-H <height>] [<file>...]\n' +
    '    map [-h | --help]\n\n' + 
    'Options:\n' +
    '    -H <height>  Height of map div\n' +
    '    -c <css>     CSS style string to be applied to map div\n' +
    '    <file>       File or object containing location data\n' +
    '    -h --help    Show this message.\n';

Map.prototype.pushMarkers = function(data) {
    var self = this;
    var key = data.lat.toString() + ';' + data.lon.toString();
    if (self.markers[key] === undefined) {
        self.markers[key] = [data.title];
    } else {
        self.markers[key].push(data.title);
    }
};

Map.prototype.next = check_next(do_docopt(fileargs(function() {
    var self = this;

    next();
    function next() {
        self.unext({}, cef(self, function(file) {
            if (file === null) {
                var height = self.docopts['-H'] || 450,
                    width = height * 4 / 3;

                self.done = true;
                if (!self.data) {
                    return self.exit(E('ENODATA'));
                } else {
                    var style = self.docopts['-c'] || "width:" + width +
                        "px;height:" + height + "px;";
                    var h = "<div id='" + self.mapId +
                        "'" + "style='" + style + "'" + " class='googleMap'>[map]</div>";
                    return self.output({html:h, callback: LoadMap});
                }
            } else {
                if (file.coords) {
                    self.data = true;
                    self.pushMarkers({
                        lat: file.coords.lat,
                        lon: file.coords.lon,
                        title: file.name
                    });
                }
                return next();
            }
        }));
    }

    function LoadMap() {
        var north = 0,
            south = 0,
            east = 0,
            west = 0;
        var firstPass = true;
        self.markers = $.map(self.markers, function(value, key) {
            return {
                lat: key.split(';')[0],
                lon: key.split(';')[1],
                title: value.join(', ')
            };
        });
        for (var i = 0; i < self.markers.length; i++) {
            var lat = parseFloat(self.markers[i].lat);
            var lon = parseFloat(self.markers[i].lon);

            if (lat > north || firstPass) north = lat;
            if (lat < south || firstPass) south = lat;
            if (lon > east || firstPass) east = lon;
            if (lon < west || firstPass) west = lon;
            firstPass = false;
        }
        
        var myLatlng = new google.maps.LatLng((north + south)/2, (east + west)/2);
        var myOptions = {
            zoom: 4,
            center: myLatlng,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        var map = new google.maps.Map(
            document.getElementById(self.mapId), myOptions);
        if (self.markers.length > 0) {
            var bounds = new google.maps.LatLngBounds(
                new google.maps.LatLng(south, west),
                new google.maps.LatLng(north, east));
            map.fitBounds(bounds);
        }

        for (var i = 0; i < self.markers.length; i++) {
            var lat = self.markers[i].lat;
            var lon = self.markers[i].lon;

            var marker = new google.maps.Marker({
                position: new google.maps.LatLng(lat, lon),
                map: map,
                title: self.markers[i].title
            });
        }
    }
})));

Command.register("map", Map);
