(function(){
	"use strict";

	// L is defined by the Leaflet library, see git://github.com/Leaflet/Leaflet.git for documentation
	L.PingLayer = L.Class.extend({
		includes: [L.Mixin.Events],

		options : {
			lng: function(d){
				return d[0];
			},
			lat: function(d){
				return d[1];
			},
			efficient: {
				enabled: false,
				fps: 8
			},
			duration: 800
		},

		initialize : function(options) {
			L.setOptions(this, options);

			var that = this;

			that._update = function() {
				var nowTs = Date.now();
				if(null == that._data) that._data = [];

				// Update everything
				for(var i=that._data.length-1; i>=0; i--) {
					var d = that._data[i];
					var age = nowTs - d.ts;

					if(that.options.duration < age){
						// If the blip is beyond it's life, remove it from the list of blips
						d.c.remove();
						that._data.splice(i, 1);

					} else {

						// If the blip is still alive, process it
						if(that.options.efficient.enabled) {
							if(d.nts < nowTs) {
								d.c.attr('r', that.radiusScale()(age))
									.attr('opacity', that.opacityScale()(age));
								d.nts = nowTs + 1000/that.options.efficient.fps;
							}
						} else {
							d.c.attr('r', that.radiusScale()(age))
								.attr('opacity', that.opacityScale()(age));
						}

					}
				}

				// The return function dictates whether the timer loop will continue
				that._running = (null != that._data && that._data.length > 0);
				return !that._running;
			};

			this._radiusScale = d3.scale.pow().exponent(0.35)
				.domain([0, this.options.duration])
				.range([3, 15])
				.clamp(true);
			this._opacityScale = d3.scale.linear()
				.domain([0, this.options.duration])
				.range([1, 0])
				.clamp(true);
		},

		onAdd : function(map) {
			this._map = map;

			// Init the state of the simulation
			this._running = false;

			// Create a container for svg.
			this._container = this._initContainer();
			this._updateContainer();

			// Set up events
			map.on({'move': this._move}, this);
		},

		onRemove : function(map) {
			this._destroyContainer();

			// Remove events
			map.off({'move': this._move}, this);

			this._container = null;
			this._map = null;
			this._data = null;
		},

		addTo : function(map) {
			map.addLayer(this);
			return this;
		},

		_initContainer : function() {
			var container = null;

			// If the container is null or the overlay pane is empty, create the svg element for drawing
			if (null == this._container) {
				var overlayPane = this._map.getPanes().overlayPane;
				container = d3.select(overlayPane).append('svg')
					.attr('class', 'leaflet-layer leaflet-zoom-hide');
			}

			return container;
		},

		_updateContainer : function() {
			var bounds = this._mapBounds();

			this._container
				.attr('width', bounds.width).attr('height', bounds.height)
				.style('margin-left', bounds.left + 'px')
				.style('margin-top', bounds.top + 'px');
		},

		_destroyContainer: function() {
			// Remove the svg element
			if(null != this._container){
				this._container.remove();
			}
		},

		_mapBounds: function(){
			var latLongBounds = this._map.getBounds();
			var ne = this._map.latLngToLayerPoint(latLongBounds.getNorthEast());
			var sw = this._map.latLngToLayerPoint(latLongBounds.getSouthWest());

			var bounds = {
				width: ne.x - sw.x,
				height: sw.y - ne.y,
				left: sw.x,
				top: ne.y
			};

			return bounds;
		},

		// Update the map based on zoom/pan/move
		_move : function() {
			this._updateContainer();
		},

		// Main update loop
		_update : undefined,

		/*
		 * Method by which to "add" pings
		 */
		ping : function(data) {
			// Lazy init the data array
			if(null == this._data) this._data = [];

			// Derive the spatial data
			var geo = [this.options.lat(data), this.options.lng(data)];
			var point = this._map.latLngToLayerPoint(geo);
			var mapBounds = this._mapBounds();

			// Add the data to the list of pings
			var circle = {
				geo: geo,
				x: point.x - mapBounds.left, y: point.y - mapBounds.top,
				ts: Date.now(),
				nts: 0
			};
			circle.c = this._container.append('circle').attr('class', 'ping')
				.attr('cx', circle.x)
				.attr('cy', circle.y)
				.attr('r', this.radiusScale().range()[0]);

			this._data.push(circle);

			// Start timer if not active
			if(!this._running && this._data.length > 0){
				this._running = true;
				d3.timer(this._update);
			}

			return this;
		},

		/*
		 * Getter/setter for the radius
		 */
		radiusScale: function(radiusScale) {
			if(undefined === radiusScale){
				return this._radiusScale;
			}

			this._radiusScale = radiusScale;
			return this;
		},

		/*
		 * Getter/setter for the opacity
		 */
		opacityScale: function(opacityScale) {
			if(undefined === opacityScale){
				return this._opacityScale;
			}

			this._opacityScale = opacityScale;
			return this;
		},

	});

	L.pingLayer = function(options) {
		return new L.PingLayer(options);
	};

})();
