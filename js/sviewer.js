/*globals $:false, ol:false, proj4:false, QRCode:false*/

// supported (re)projections. add more in customConfig.js
proj4.defs([
    ["EPSG:4326", "+title=WGS 84, +proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs"],
    ["EPSG:3857", "+title=Web Spherical Mercator, +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs"],
    ["EPSG:900913", "+title=Web Spherical Mercator, +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs"],
    ["EPSG:2154", "+title=RGF-93/Lambert 93, +proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"]
]);

// map projection and grids (retrodata)
var projcode = 'EPSG:3857';
var projection = ol.proj.get(projcode);
var projectionExtent = projection.getExtent();
var size = ol.extent.getWidth(projectionExtent) / 256;
var resolutions = new Array(20);
var matrixIds = new Array(20);
var matrixIdsIGN = new Array(20);
for (var z = 0; z < 20; ++z) {
    resolutions[z] = size / Math.pow(2, z);
    matrixIds[z] = projcode + ':' + z;
    matrixIdsIGN[z] = z; // matrixIds array for IGN WMTS added by HS
}

var config = {};
var customConfig = {};
var hardConfig = {
    title: 'geOrchestra mobile',
    geOrchestraBaseUrl: 'https://sdi.georchestra.org/',
    projcode: 'EPSG:3857',
    initialExtent: [-12880000, -1080000, 5890000, 7540000],
    maxExtent: [-20037508.34, -20037508.34, 20037508.34, 20037508.34],
    restrictedExtent: [-20037508.34, -20037508.34, 20037508.34, 20037508.34],
    maxFeatures: 10,
    nodata: '<!--nodatadetect-->\n<!--nodatadetect-->',
    openLSGeocodeUrl: "http://gpp3-wxs.ign.fr/[CLEF GEOPORTAIL]/geoportail/ols?",
    layersBackground: [
        new ol.layer.Tile({
            source: new ol.source.OSM()
        })
    ],
    socialMedia: {
        'Twitter': 'https://twitter.com/intent/tweet?text=',
        'Google+': 'https://plus.google.com/share?url=',
        'Facebook': 'http://www.facebook.com/sharer/sharer.php?u='
    }
};

var debug;

var SViewer = function () {
    var map;
    var timeline;
    var view;
    var marker;

    // ----- pseudoclasses ------------------------------------------------------------------------------------

    /**
     * LayerQueryable is an enhanced ol3.layer.wms
     * @constructor
     * @param {Object} options or qs layer param (string)
     */
    function LayerQueryable(options) {
        this.options = {
            nslayername: '',
            layername: '',
            namespace: '',
            stylename: '',
            qcl_filter: '',
            wmsurl_global: '',
            wmsurl_ns: '',
            wmsurl_layer: '',
            sldurl: null,
            format: 'image/png',
            opacity: 1,
        };
        this.md = {
            title: '',
            abstract: '',
            isTime: false
        };
        this.wmslayer = null;

        // to allow usage of this. in jquery statements
        var self = this;

        /**
         * Parses a wms layer descriptor, calls the legend, returns the wms layer
         * @param {String} s the querystring describing the layer
         */
        function parseLayerParam(s) {
            self.options.nslayername = s.split('*')[0]; // namespace:layername
            self.options.stylename = (s.indexOf("*") > 0) ? s.split('*', 2)[1] : ''; // stylename
            self.options.cql_filter = (s.indexOf("*") > 1) ? s.split('*', 3)[2] : ''; // qcl_filter

            self.options.namespace = (self.options.nslayername.indexOf(":") > 0) ? self.options.nslayername.split(':', 2)[0] : ''; // namespace
            self.options.layername = (self.options.nslayername.indexOf(':') > 0) ? self.options.nslayername.split(':', 2)[1] : ''; // layername
            self.options.wmsurl_global = config.geOrchestraBaseUrl + 'geoserver/wms'; // global getcap
            self.options.wmsurl_ns = config.geOrchestraBaseUrl + 'geoserver/' + self.options.namespace + '/wms'; // virtual getcap namespace
            self.options.wmsurl_layer = config.geOrchestraBaseUrl + 'geoserver/' + self.options.namespace + '/' + self.options.layername + '/wms'; // virtual getcap layer
        }

        /**
         * Creates the ol3 WMS layer
         */
        function createLayer() {
            var wms_params = {
                'url': self.options.wmsurl_ns,
                params: {
                    'LAYERS': self.options.layername,
                    'FORMAT': self.options.format,
                    'TRANSPARENT': true,
                    'STYLES': self.options.stylename
                },
                extent: config.maxExtent
            };
            if (self.options.cql_filter) {
                wms_params.params.CQL_FILTER = self.options.cql_filter;
            }
            if (self.options.sldurl) {
                wms_params.params.SLD = self.options.sldurl;
            }
            self.wmslayer = new ol.layer.Tile({
                opacity: isNaN(self.options.opacity) ? 1 : self.options.opacity,
                source: new ol.source.TileWMS(wms_params)
            });
        }

        /**
         * refresh layer with TIME dimension (exposed)
         */
        function setTime(t) {
            if (self.md.isTime) {
                self.wmslayer.getSource().updateParams({
                    'TIME': t.toISOString()
                });
            }
        }
        this.setTime = setTime;

        /**
         * Queries the layer capabilities to display its legend and metadata
         */
        function getMetadata(self) {
            var parser = new ol.format.WMSCapabilities();
            $.ajax({
                url: ajaxURL(self.options.wmsurl_ns + '?SERVICE=WMS&REQUEST=GetCapabilities'),
                type: 'GET',
                success: function (response) {
                    var html = [];
                    var capabilities, mdLayer, legendArgs;
                    capabilities = parser.read(response);
                    // searching for the layer in the capabilities
                    $.each(capabilities.Capability.Layer.Layer, function () {
                        if (this.Name === self.options.layername) {
                            mdLayer = this;
                        }
                    });

                    if (mdLayer) {
                        html.push('<div class="sv-md">');
                        legendArgs = {
                            'SERVICE': 'WMS',
                            'VERSION': capabilities.version,
                            'REQUEST': 'GetLegendGraphic',
                            'FORMAT': 'image/png',
                            'LAYER': mdLayer.Name,
                            'STYLE': self.options.stylename
                        };
                        if (self.options.sldurl) {
                            legendArgs.SLD = self.options.sldurl;
                        }

                        // attribution
                        if (mdLayer.Attribution) {
                            html.push('<span class="sv-md-attrib">' + escHTML(tr('source')));
                            html.push(' : <a target="_blank" href="' + escHTML(mdLayer.Attribution.OnlineResource) + '" >');
                            if (mdLayer.Attribution.LogoURL) {
                                html.push('<img class="sv-md-logo" src="' + escHTML(mdLayer.Attribution.LogoURL.OnlineResource) + '" /><br />');
                            }
                            html.push(escHTML(mdLayer.Attribution.Title));
                            html.push('</a></span>');
                        }

                        // title
                        html.push('<p><h4 class="sv-md-title">' + escHTML(mdLayer.Title) + '</h4>');
                        self.md.title = mdLayer.Title;
                        if (config.search) {
                            config.searchparams.title = self.md.title;
                        }

                        // abstract
                        html.push("<p class='sv-md-abstract'>" + escHTML(mdLayer.Abstract));
                        self.md.Abstract = mdLayer.Abstract;

                        // metadata
                        if (mdLayer.hasOwnProperty('MetadataURL')) {
                            $.each(mdLayer.MetadataURL, function () {
                                if (this.Format === "text/html") {
                                    html.push('&nbsp;<a target="_blank" class="sv-md-meta" href="' + escHTML(this.OnlineResource) + '">');
                                    html.push(tr('metadata'));
                                    html.push(" ... </a>");
                                }
                            });
                        }
                        html.push("</p>");

                        // legend
                        html.push('<img class="sv-md-legend" src="');
                        html.push(self.options.wmsurl_ns + '?' + $.param(legendArgs));
                        html.push('" />');
                        html.push('</div>');

                        $('#legend').append(html.join(''));

                        // WMS dimensions
                        if (mdLayer.hasOwnProperty('Dimension') && mdLayer.Dimension) {
                            // looking for time dimension
                            $.each(mdLayer.Dimension, function (i, d) {
                                if (d.name === "time" && d.units === "ISO8601") {
                                    $('.sv-timeline').css({
                                        display: "block"
                                    });
                                    self.md.isTime = true;
                                    $.each(d.values.split(','), function (i, val) {
                                        config.dates.add({
                                            start: new Date(val),
                                            title: self.md.title + '<br />' + val
                                        });
                                    })
                                }
                            });
                            config.dates.flush();

                            // permalink handler
                            // selects for the provided date in the dataset
                            // or fall back to last date
                            // TODO : if not exists : nearest date ? or user warning ?
                            var ordered = config.dates.getIds({
                                    order: 'start'
                                }),
                                dateselected,
                                id,
                                firstid,
                                lastid;
                            if (config.time) {
                                var dateprovided = new Date(config.time);
                                $.each(config.dates.get(), function (i, item) {
                                    if (item.start - dateprovided == 0) {
                                        dateselected = item.start;
                                        id = item.id;
                                        firstid = ordered[Math.max(i - 25, 0)];
                                        lastid = ordered[Math.min(i + 25, ordered.length - 1)];
                                    }
                                });
                            }

                            // fall back to max date
                            if (!id) {
                                firstid = ordered[Math.max(ordered.length - 50, 0)];
                                lastid = ordered[ordered.length - 1];
                                id = lastid;
                                dateselected = config.dates.get(lastid).start;
                            }

                            // center timeline, updates layer, displays date
                            // TODO : getfeatureinfo update
                            config.timeline.focus([firstid, lastid]);
                            config.timeline.setSelection(id);
                            setTime(dateselected);
                            $('.sv-date').css({
                                'display': 'block'
                            });
                            $('.sv-date').text(dateselected.toLocaleString());
                        }
                    }
                },
                failure: function () {}
            });
        }

        /**
         * constructor
         */
        this.construct = function (options) {
            // layers from query string parameter
            if ($.type(options) === "string") {
                parseLayerParam(options);
            } else {
                $.extend(this.options, options);
            }
            createLayer();
            getMetadata(self);
        };

        this.construct(options);
    }

    // ----- methods ------------------------------------------------------------------------------------

    /**
     * Sanitize strings
     * @param {String} s input string
     * @return {String} secured string
     */
    function escHTML(s) {
        return $('<p/>').text(s).html();
    }

    /**
     * Returns a proxified URL for Ajax XSS
     * @param {String} url
     * @return {String} Ajax url
     */
    function ajaxURL(url) {
        // relative path
        if (url.indexOf('http') !== 0) {
            return url;
        }
        // same domain
        else if (url.indexOf(location.protocol + '//' + location.host) === 0) {
            return url;
        } else {
            return '/proxy/?url=' + encodeURIComponent(url);
        }
    }

    /**
     * Translates strings
     * @param {String} s input string
     * @return {String} translated string
     */
    function tr(s) {
        if ($.type(hardConfig.i18n[config.lang][s]) === 'string') {
            return hardConfig.i18n[config.lang][s];
        } else {
            return s;
        }
    }

    /**
     * DOM elements i18n
     * @param selector {String} jQuery selector
     * @param propnames {Array} array of property names
     */
    function translateDOM(selector, propnames) {
        $.each($(selector), function (i, e) {
            // text translation
            $(e).text(tr($(e).text()));
            // properties translation
            $.each(propnames, function (j, p) {
                if (p !== "value") {
                    $(e).prop(p, tr($(e).prop(p)));
                } else {
                    $(e).val(tr($(e).prop(p)));
                }
            });
        });
    }

    /**
     * Adjust map size on resize
     */
    function fixContentHeight() {
        var header = $("#header"),
            content = $("#frameMap"),
            viewHeight = $(window).height(),
            contentHeight = viewHeight - header.outerHeight();

        if ((content.outerHeight() + header.outerHeight()) !== viewHeight) {
            contentHeight -= (content.outerHeight() - content.height());
            content.height(contentHeight);
        }
        if (window.map) {
            map.updateSize();
        }
    }


    /**
     * Parses the query string
     *  Credits http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
     * @param {String} s param name
     * @return {String} param value
     */
    var qs = (function (s) {
        if (s === "") {
            return {};
        }
        var b = {};
        for (var i = 0; i < s.length; ++i) {
            var p = s[i].split('=');
            if (p.length != 2) {
                continue;
            }
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }
        return b;
    })(window.location.search.substr(1).split('&'));


    /**
     * Iterates over background layers, sets the visibility according to the lb parameter.
     * @param {Integer} lb layer index, optional
     * @returns {ol.layer} layer the visible background layer
     */
    function switchBackground(lb) {
        var n = config.layersBackground.length;
        var lv = 0;
        // look for the visible layer and hide all layers
        $.each(config.layersBackground, function (i, layer) {
            if (layer.getVisible()) {
                lv = i;
            }
            layer.setVisible(false);
        });
        // if lb specified, show this layer
        if (typeof (lb) === 'number') {
            config.layersBackground[config.lb].setVisible(true);
        }
        // otherwise, show next layer
        else {
            config.lb = (lv + 1) % n;
            config.layersBackground[config.lb].setVisible(true);
        }
        return config.layersBackground[config.lb];
    }


    /**
     * Loads, parses a Web Map Context and instanciates layers
     * ol3 does dot support WMC format for now
     * @param {String} wmc id of the map or URL of the web map context
     */
    function parseWMC(wmc) {
        var url = '';
        // todo : missing ol3 WMC native support
        function parseWMCResponse(response) {
            var wmc = $('ViewContext', response);
            config.wmctitle = $(wmc).children('General').children('Title').text();
            if (config.wmctitle !== "") {
                setTitle(config.wmctitle);
            }

            // recenter on  WMC extent if xyz not specified
            if (isNaN(config.x)) {
                var vgb = $(wmc).children('General').children('BoundingBox');
                var srs = vgb.attr('SRS');
                var extent = [vgb.attr('minx'), vgb.attr('miny'), vgb.attr('maxx'), vgb.attr('maxy')];
                view.fit(ol.proj.transformExtent(extent, srs, config.projcode), map.getSize());
            }

            // we only consider visible and queryable layers
            $(wmc).find('LayerList > Layer[queryable=1]').each(function () {
                if ($(this).attr('hidden') != '1') {
                    var options = {};
                    options.nslayername = $(this).children('Name').text();
                    options.namespace = '';
                    options.layername = $(this).children('Name').text();
                    options.wmsurl_global = $(this).find('Server > OnlineResource').attr('xlink:href');
                    options.wmsurl_ns = options.wmsurl_global;
                    options.wmsurl_layer = options.wmsurl_global;
                    options.format = $(this).find("FormatList  > Format[current='1']").text();
                    options.sldurl = ($(this).find("StyleList  > Style[current='1'] > SLD > OnlineResource").attr('xlink:href'));
                    options.stylename = $(this).find("StyleList  > Style[current='1'] > Name").text();
                    options.opacity = parseFloat($(this).find("opacity").text());
                    var l = new LayerQueryable(options);
                    config.layersQueryable.push(l);
                    map.addLayer(l.wmslayer);
                    $.mobile.loading('hide');
                }
            });

            //activate search if required
            if (config.search) {
                activateSearchFeatures('remote');
            }

            // perform gfi if requied
            if (config.gfiok) {
                queryMap(view.getCenter());
            }
        }

        // wmc comes from a geOrchestra map id
        if (wmc.match(wmc.match(/^[a-z\d]{32}$/))) {
            url = config.geOrchestraBaseUrl + 'mapfishapp/ws/wmc/geodoc' + wmc + '.wmc';
        }
        // wmc is an url
        else {
            url = wmc;
        }

        if (url !== '') {
            $.mobile.loading('show');
            $.ajax({
                url: ajaxURL(url),
                type: 'GET',
                dataType: 'XML',
                success: parseWMCResponse,
                error: function (xhr) {
                    if (xhr.status == 404) {
                        messagePopup(tr("map context not found"));
                    } else {
                        messagePopup(tr("map context error"));
                    }
                    $.mobile.loading('hide');
                }
            });
        }
    }


    /**
     * Method: buildPermalink
     * constructs a permalink
     */
    function buildPermalink() {
        var permalinkHash, permalinkQuery;
        var c = view.getCenter();
        var linkParams = {};
        if (config.gficoord && config.gfiz && config.gfiok) {
            linkParams.x = encodeURIComponent(Math.round(config.gficoord[0]));
            linkParams.y = encodeURIComponent(Math.round(config.gficoord[1]));
            linkParams.z = encodeURIComponent(config.gfiz);
            linkParams.q = '1';
        } else {
            linkParams.x = encodeURIComponent(Math.round(c[0]));
            linkParams.y = encodeURIComponent(Math.round(c[1]));
            linkParams.z = encodeURIComponent(view.getZoom());
        }
        linkParams.lb = encodeURIComponent(config.lb);
        if (config.customConfigName) {
            linkParams.c = config.customConfigName;
        }
        if (config.kmlUrl) {
            linkParams.kml = config.kmlUrl;
        }
        if (config.search) {
            linkParams.s = '1';
        }
        if (config.layersQueryString) {
            linkParams.layers = config.layersQueryString;
        }
        if (config.title && config.wmctitle != config.title) {
            linkParams.title = config.title;
        }
        if (config.wmc) {
            linkParams.wmc = config.wmc;
        }
        permalinkHash = window.location.origin + window.location.pathname + "#" + $.param(linkParams);
        permalinkQuery = window.location.origin + window.location.pathname + "?" + $.param(linkParams);
        return permalinkQuery;
    }

    /**
     * Method: setPermalink
     * keeps permalinks display synchronized with map extent
     */
    function setPermalink() {
        // permalink, social links & QR code update only if frame is visible
        if ($('#panelShare').css('visibility') === 'visible') {
            var permalinkHash, permalinkQuery;
            var c = view.getCenter();
            var linkParams = {};
            if (config.gficoord && config.gfiz && config.gfiok) {
                linkParams.x = encodeURIComponent(Math.round(config.gficoord[0]));
                linkParams.y = encodeURIComponent(Math.round(config.gficoord[1]));
                linkParams.z = encodeURIComponent(config.gfiz);
                linkParams.q = '1';
            } else {
                linkParams.x = encodeURIComponent(Math.round(c[0]));
                linkParams.y = encodeURIComponent(Math.round(c[1]));
                linkParams.z = encodeURIComponent(view.getZoom());
            }
            linkParams.lb = encodeURIComponent(config.lb);
            if (config.customConfigName) {
                linkParams.c = config.customConfigName;
            }
            if (config.kmlUrl) {
                linkParams.kml = config.kmlUrl;
            }
            if (config.search) {
                linkParams.s = '1';
            }
            if (config.layersQueryString) {
                linkParams.layers = config.layersQueryString;
            }
            if (config.title && config.wmctitle != config.title) {
                linkParams.title = config.title;
            }
            if (config.wmc) {
                linkParams.wmc = config.wmc;
            }

            // wms TIME
            if (config.time) {
                linkParams.time = config.time.toISOString();
            }

            permalinkHash = window.location.origin + window.location.pathname + "#" + $.param(linkParams);
            permalinkQuery = window.location.origin + window.location.pathname + "?" + $.param(linkParams);

            $('#socialLinks').empty();
            $.each(config.socialMedia, function (name, socialUrl) {
                $('#socialLinks').append('<a class="ui-btn ui-shadow ui-corner-all" target="_blank" href="' +
                    socialUrl +
                    encodeURIComponent(permalinkQuery) +
                    '" title="' +
                    tr('share on ') +
                    name + '">' +
                    name + '</a>'
                );
            });
            $('#georchestraForm').attr('action', config.geOrchestraBaseUrl + 'mapfishapp/');
            if ($('#qrcode').css("visibility") === "visible") {
                $('#qrcode').empty();
                new QRCode("qrcode", {
                    text: permalinkQuery,
                    width: 130,
                    height: 130,
                    correctLevel: QRCode.CorrectLevel.L
                });
            }
            $('#permalink').prop('href', permalinkQuery);
        }
    }


    /**
     * Call external viewers
     * @param viewerId {String} the external viewer codename
     */
    function sendMapTo(viewerId) {
        // sendto : georchestra advanced viewer
        if (viewerId === "georchestra_viewer") {
            var params = {
                "services": [],
                "layers": []
            };
            $.each(config.layersQueryable, function (i, layer) {
                params.layers.push({
                    "layername": layer.options.layername,
                    "owstype": "WMS",
                    "owsurl": layer.options.wmsurl_layer
                });
            });
            $("#georchestraFormData").val(JSON.stringify(params));
            //~ return true;
            return false;
        }
    }

    /**
     * updates time enabled wms layers to specified time
     * @param {Date} TIME parameter value, ISO8601
     */
    function setTimeAll(t) {
        // update layer source with time parameter
        $.each(config.layersQueryable, function (i, layer) {
            if (layer.md.isTime === true) {
                layer.setTime(t);
                // register date for permalink
                config.time = t;
            }
        })
        // displays selected datetime
        $('.sv-date').css({
            'display': 'block'
        });
        $('.sv-date').text(t.toLocaleString());
        // re getfeature info
        if (config.gficoord && config.gfiz && config.gfiok) {
            queryMap(config.gficoord)
        }
    }

    /**
     * Queries the OpenLS service and recenters the map
     * @param text {String} the OpenLS plain text query
     */
    function openLsRequest(text) {

        function onOpenLSSuccess(response) {
            $.mobile.loading('hide');
            try {
                var zoom = false,
                    extent = [],
                    results = $(response).find('GeocodedAddress'),
                    items = [];
                if (results.length > 0) {
                    $.each(results, function (i, res) {
                        var a = res.getElementsByTagNameNS('http://www.opengis.net/gml', 'pos')[0].textContent.split(' '),
                            lonlat = [parseFloat(a[1]), parseFloat(a[0])],
                            matchType = results.find('GeocodeMatchCode').attr('matchType'),
                            ptResult = ol.proj.transform(lonlat, 'EPSG:4326', config.projcode),
                            street = $(res).find("Street").text(),
                            municipality = $(res).find('[type="Municipality"]').text();
                        switch (matchType) {
                            case 'City':
                                zoom = 15;
                                break;
                            case 'Street':
                                zoom = 17;
                                break;
                            case 'Street enhanced':
                                zoom = 18;
                                break;
                            case 'Street number':
                                zoom = 18;
                                break;
                        }
                        if (!zoom) {
                            extent = ol.proj.transformExtent(
                                JSON.parse('[' + $(results[i]).find('[type="Bbox"]').text().replace(/;/g, ",") + ']'),
                                'EPSG:4326',
                                map.getView().getProjection().getCode()
                            );
                        }
                        var code = $(res).find('[type="INSEE"]').text();
                        var resultElems = [municipality, code];
                        if (street.length > 1) {
                            resultElems.unshift(street);
                        }
                        var label = resultElems.join(" ");
                        var item = $('<li class="sv-location" data-icon="location"><a href="#"></a></li>')
                            .find("a")
                            .text(label)
                            .parent()
                            .attr("title", resultElems.join('\n'))
                            .click({
                                'extent': extent,
                                'coordinates': ptResult,
                                'zoom': zoom
                            }, onSearchItemClick);
                        items.push(item);
                    });
                    $("#searchResults").prepend(items);
                    $("#searchResults").prepend('<li data-role="list-divider">Localit&eacute;s</li>');
                    $("#searchResults").listview().listview('refresh');
                } else {
                    //$('#locateMsg').text('No result');
                    $.mobile.loading('hide');
                }
            } catch (err) {
                $('#locateMsg').text(tr('Geolocation failed'));
                $.mobile.loading('hide');
            }
        }

        function onOpenLSFailure(response) {
            $('#locateMsg').text(tr('Geolocation failed'));
            $.mobile.loading('hide');
        }

        try {
            var extent = ol.proj.transformExtent(config.initialExtent, map.getView().getProjection().getCode(), 'EPSG:4326');
            var q = text.trim();
            var qa = q.split(',');
            if (q.length > 0) {
                var countryCode = 'ALL';
                var freeFormAddress = '';
                if (qa.length > 1) {
                    // address and municipality separated by a comma
                    var address = qa.slice(0, qa.length - 1).join(' ').trim();
                    var municipality = qa[qa.length - 1].trim();
                    countryCode = 'StreetAddress';
                    freeFormAddress = address + ' ' + municipality;
                } else {
                    // municipality alone
                    countryCode = 'StreetAddress';
                    freeFormAddress = q;
                }

                $.ajax({
                    url: ajaxURL(config.openLSGeocodeUrl),
                    type: 'POST',
                    data: [
                    /*jshint multistr: true */
                        '<?xml version="1.0" encoding="UTF-8"?> \
                        <XLS xmlns:xls="http://www.opengis.net/xls" \
                        xmlns:gml="http://www.opengis.net/gml" \
                        xmlns="http://www.opengis.net/xls" \
                        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
                        version="1.2" \
                        xsi:schemaLocation="http://www.opengis.net/xls http://schemas.opengis.net/ols/1.2/olsAll.xsd"> \
                        <RequestHeader/> \
                        <Request maximumResponses="' + config.maxFeatures + '" requestID="1" version="1.2" methodName="LocationUtilityService"> \
                        <GeocodeRequest returnFreeForm="false"> \
                        <Address countryCode="',
                        countryCode,
                        '">\n \
                        <freeFormAddress>',
                        freeFormAddress,
                        '</freeFormAddress> \
                        <gml:envelope> \
                        <gml:pos>',
                        ol.extent.getBottomLeft(extent).reverse().join(" "),
                        '</gml:pos> \
                        <gml:pos>',
                        ol.extent.getTopRight(extent).reverse().join(" "),
                        '</gml:pos> \
                        </gml:envelope> \
                        </Address> \
                        </GeocodeRequest> \
                        </Request> \
                        </XLS>'].join(""),
                    contentType: "application/xml",
                    success: onOpenLSSuccess,
                    failure: onOpenLSFailure
                });
                $.mobile.loading('show', {
                    text: tr("searching...")
                });
            }
        } catch (err) {
            messagePopup(tr('Geolocation failed'));
            $.mobile.loading('hide');
        }
    }

    /**
     * getFeatureInfo
     */
    function queryMap(coord) {
        var p = map.getPixelFromCoordinate(coord);
        config.gficoord = coord;
        config.gfiok = false;
        config.gfiz = view.getZoom();
        var viewResolution = view.getResolution();

        marker.setPosition(config.gficoord);
        $('#marker').show();
        // recenter anime
        var pan = ol.animation.pan({
            duration: 1000,
            source: view.getCenter()
        });
        map.beforeRender(pan);
        view.setCenter(config.gficoord);
        $('#panelInfo').popup('close');
        $('#querycontent').html('');

        // WMS getFeatureInfo
        $.each(config.layersQueryable, function () {
            var url = this.wmslayer.getSource().getGetFeatureInfoUrl(
                config.gficoord,
                viewResolution,
                config.projection, {
                    'INFO_FORMAT': 'text/html',
                    'FEATURE_COUNT': config.maxFeatures
                }
            );

            // response order = layer order
            var domResponse = $($('<div>').append($('<span class="sv-md-title">').text(this.md.title)));
            $('#querycontent').append(domResponse);
            // ajax request
            $.mobile.loading('show');
            $.ajax({
                url: ajaxURL(url),
                type: 'GET',
                dataType: 'html',
                context: domResponse,
                success: function (response) {
                    // nonempty reponse detection
                    if (response.search('ServiceExceptionReport') > 0) {
                        console.log('getFeatureInfo exception');
                    } else if (response.search(config.nodata) < 0) {
                        $.each(['#panelInfo', '#panelLocate', '#panelShare'], function (i, p) {
                            $(p).popup('close');
                        });
                        $(this).append(response);
                        config.gfiok = true;
                        $('#panelQuery a').attr("rel", "external");
                        $('#panelQuery').popup('open');
                    } else {
                        $('#panelQuery').popup('open');
                        $(this).append($('<p class="sv-noitem">').text(tr('no item found')));
                        config.gfiok = false;
                    }
                    $.mobile.loading('hide');
                },
                failure: function () {
                    $.mobile.loading('hide');
                    $(this).append($('<p class="sv-noitem">').text(tr('query failed')));
                }
            });
        });

        // KML getFeatureInfo
        if (config.kmlLayer) {
            var features = [];
            var domResponse = $('<div class="sv-kml"></div>');
            map.forEachFeatureAtPixel(p, function (feature, layer) {
                features.push(feature);
            });
            if (features.length > 0) {
                $.each(features, function () {
                    $('#panelQuery').popup('open');
                    if (this.get('description')) {
                        domResponse.append(this.get('description'));
                    } else {
                        $.each(this.getProperties(), function (k, v) {
                            if ($.type(v) === "string") {
                                domResponse.append($('<span class="sv-key">').text(k + ':'));
                                domResponse.append($('<span class="sv-value">').text(v));
                                domResponse.append($('<br>'));

                            }
                        });
                    }
                });
                $('#querycontent').append(domResponse);
            }
        }


    }

    /**
     * clear getFeatureInfo
     */
    function clearQuery() {
        $('#marker').hide('fast');
        $('#panelQuery').popup('close');
        $('#querycontent').text(tr('Query the map'));
        config.gficoord = null;
        config.gfiz = null;
        config.gfiok = false;
    }

    /**
     * method: searchFeatures
     * search features whose string attributes match a pattern;
     * 'local' mode handles KML featureCollections
     * 'remote' mode performs a WFS getFeature query,
     * @param {String} value search pattern
     */
    function searchFeatures(value) {
        if (value.length > 1) {
            config.searchparams.term = value;
            if (config.searchparams.mode === 'remote') {
                var ogcfilter = [],
                    propertynames = [],
                    getFeatureRequest;

                $.each(config.searchparams.searchfields, function (i, fieldname) {
                    /*matchCase="false" for PropertyIsLike don't works with geoserver 2.5.0* in wfs 2.0.0 version*/
                    ogcfilter.push(
                        '<ogc:PropertyIsLike wildCard="*" singleChar="." escapeChar="!" matchCase="false" >' +
                        '<ogc:PropertyName>' + fieldname + '</ogc:PropertyName>' +
                        '<ogc:Literal>*' + value + '*</ogc:Literal></ogc:PropertyIsLike>');
                    propertynames.push('<ogc:PropertyName>' + fieldname + '</ogc:PropertyName>');
                });
                propertynames.push('<ogc:PropertyName>' + config.searchparams.geom + '</ogc:PropertyName>');
                if (config.searchparams.searchfields.length > 1) {
                    ogcfilter.unshift('<ogc:Or>');
                    ogcfilter.push('</ogc:Or>');
                }
                ogcfilter.unshift('<ogc:And>');
                ogcfilter.push(['<ogc:BBOX>',
                        '<ogc:PropertyName>' + config.searchparams.geom + '</ogc:PropertyName>',
                        '<gml:Envelope xmlns:gml="http://www.opengis.net/gml" srsName="' + config.projection.getCode() + '">',
                          '<gml:lowerCorner>' + ol.extent.getBottomLeft(config.initialExtent).join(" ") + '</gml:lowerCorner>',
                          '<gml:upperCorner>' + ol.extent.getTopRight(config.initialExtent).join(" ") + '</gml:upperCorner>',
                        '</gml:Envelope>',
                      '</ogc:BBOX>'].join(' '));
                ogcfilter.push('</ogc:And>');

                getFeatureRequest = ['<?xml version="1.0" encoding="UTF-8"?>',
                    '<wfs:GetFeature',
                        'xmlns:wfs="http://www.opengis.net/wfs" service="WFS" version="1.1.0"',
                        'xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd"',
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" maxFeatures="' + config.maxFeatures + '" outputFormat="application/json">',
                          '<wfs:Query xmlns:ogc="http://www.opengis.net/ogc"' +
                           ' typeName="' + config.searchparams.typename + '" srsName="' + config.projection.getCode() + '">',
                            propertynames.join(' '),
                            '<ogc:Filter>',
                               ogcfilter.join(' '),
                            '</ogc:Filter>',
                        '</wfs:Query>',
                    '</wfs:GetFeature>'].join(' ');
                $.ajax({
                    type: 'POST',
                    url: ajaxURL(config.searchparams.url),
                    data: getFeatureRequest,
                    dataType: 'json',
                    contentType: "application/xml",
                    success: function (response) {
                        var f = new ol.format.GeoJSON().readFeatures(response);
                        if (f.length > 0) {
                            featuresToList(f);
                        }
                    },
                    failure: function () {
                        console.log('error ');
                    }
                });
            }
            if (config.searchparams.mode === 'local') {
                // construct a pseudo index the first use
                if (!config.searchindex) {
                    var pseudoIndex = [];
                    $.each(config.kmlLayer.getSource().getFeatures(), function (i, feature) {
                        // construct an index with all text attributes
                        var id = feature.getId();
                        var props = feature.getProperties();
                        var idx = "";
                        $.each(props, function (key, value) {
                            if (key == "name" && typeof (value === 'string')) {
                                idx += '|' + value.toLowerCase();
                            }
                        });
                        pseudoIndex.push({
                            id: id,
                            data: idx
                        });
                    });
                    config.searchindex = pseudoIndex;
                }
                // use pseudo index to retrieve matching features
                if (config.searchindex) {
                    var features = [];
                    var responses = 0;
                    $.each(config.searchindex.slice(0, config.maxFeatures), function (i, v) {
                        if (config.searchindex[i].data.indexOf(value.toLowerCase()) != -1) {
                            features.push(config.kmlLayer.getSource().getFeatureById(config.searchindex[i].id));
                            responses += 1;
                        }
                    });
                    featuresToList(features);
                }
            }
        }
    }

    /**
     * method: activateSearchFeatures
     * prepares for feature search;
     * performs DescribeLayer/DescribeFeatureType if necessary
     * @param {String} mode local|remote
     */
    function activateSearchFeatures(mode) {
        config.searchparams.mode = mode;
        if (mode === 'remote') {
            var searchLayer = config.layersQueryable[config.layersQueryable.length - 1];
            if (searchLayer) {
                config.searchparams.title = searchLayer.md.title;
                // get DescribeLayer from last Layer
                var describeLayerUrl = searchLayer.options.wmsurl_ns;
                $.ajax({
                    url: ajaxURL(describeLayerUrl + "?" + $.param({
                        'SERVICE': 'WMS',
                        'VERSION': '1.1.1',
                        'REQUEST': 'DescribeLayer',
                        'LAYERS': searchLayer.options.layername
                    })),
                    type: 'GET',
                    success: function (response) {
                        config.searchparams.url = $(response).find("LayerDescription").attr("wfs");
                        config.searchparams.typename = $(response).find("Query").attr("typeName");
                        $.ajax({
                            url: ajaxURL(
                                $(response).find("LayerDescription").attr("wfs") +
                                $.param({
                                    'SERVICE': 'WFS',
                                    'VERSION': '1.0.0',
                                    'REQUEST': 'DescribeFeatureType',
                                    'TYPENAME': $(response).find("Query").attr("typeName")
                                })
                            ),
                            type: 'GET',
                            success: function (response) {
                                var fields = [];
                                $(response.getElementsByTagNameNS("*", "sequence")).find('[type="xsd\\:string"]')
                                    .each(function (i) {
                                        fields.push($(this).attr("name"));
                                    });
                                config.searchparams.geom = $(response.getElementsByTagNameNS("*",
                                    "sequence")).find('[type*="gml\\:"]').attr("name");
                                config.searchparams.searchfields = fields;
                                config.searchparams.ns = $(response.getElementsByTagNameNS("*", "schema"))
                                    .attr("targetNamespace");
                                config.searchparams.name = config.searchparams.typename.split(":")[1];
                            },
                            failure: function () {
                                alert('error');
                            }
                        });

                    },
                    failure: function () {
                        alert('error');
                    }
                });
            }
        }
        if (mode === 'local') {
            //nothing for the moment. the local search initializes on first search.
        }
    }

    /**
     * method: onSearchItemClick
     * recenters map on feature click
     * @param {Jquery.Event} event
     */
    function onSearchItemClick(event) {
        var data = event.data;
        marker.setPosition(event.data.coordinates);
        if (data.extent.length === 4 && !(data.extent[0] == data.extent[2] && data.extent[1] == data.extent[3])) {
            view.fit(data.extent, map.getSize());
        } else {
            view.setCenter(data.coordinates, map.getSize());
            view.setZoom(data.zoom || 16);
        }
        $('#marker').show();
    }


    /**
     * method: featuresToList
     * renders a clickable list of features
     * @param {ol.features} features
     */
    function featuresToList(features) {
        var lib = config.searchparams.title || tr('Top layer');
        $("#searchResults").append($('<li data-role="list-divider">').text(lib));

        $.each(features, function (i, feature) {
            var geom = feature.getGeometry(),
                attributes = feature.getProperties(),
                tips = [],
                title = [];

            $.map(attributes, function (val, i) {
                if (typeof (val) === 'string') {
                    tips.push(i + ' : ' + val);
                    if (val.toLowerCase().search(config.searchparams.term.toLowerCase()) != -1) {
                        title.push(val);
                    }
                }
            });

            $('<li class="sv-feature" data-icon="star"><a href="#"></a></li>')
                .find("a")
                .text(title.join(", "))
                .click({
                    'extent': geom.getExtent(),
                    'coordinates': (geom.getType() === 'Point') ? geom.getCoordinates() : ol.extent.getCenter(geom.getExtent())
                }, onSearchItemClick)
                .parent()
                .attr("title", tips.join('\n'))
                .appendTo($("#searchResults"));
        });
        $("#searchResults").listview().listview('refresh');
    }

    /**
     * method : simfen/WPS
     * use sviewer for wps and dashboard
     */

    /*function ConvertToCSV(objArray) {
        var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
        // header of csvfile
        var str = 'date;runoff' + '\r\n';

        for (var i = 0; i < array.length; i++) {
            var line = '';
            for (var index in array[i]) {
                if (line != '') line += ';'
                line += array[i][index];
            }
            str += line + '\r\n';
        }
        return str;
    }*/

    function positionToL93(coordinate) {
        // Recupere la coordonnee du point clique en epsg:3857
        //var coordinate = e.coordinate;
        // Convertie la coordonnee en Lambert 93 (projection du wps)
        var coordinateL93 = ol.proj.transform(coordinate, 'EPSG:3857', 'EPSG:2154');
        // Initialise un arrondi a 2 decimale et l'applique sur la coordonnee en Lambert 93
        var coordRounded = ol.coordinate.createStringXY(2);
        var out = coordRounded(coordinateL93);
        return out;
    }

    // Cree la variable xmlrequest
    function getXDomainRequest() {
        var xhr = null;
        // sous internet explorer
        if (window.XDomainRequest) {
            xhr = new XDomainRequest();
            // autres navigateurs
        } else if (window.XMLHttpRequest) {
            xhr = new XMLHttpRequest();
        } else {
            alert("Erreur initialisation XMLHttpRequests");
        }
        return xhr;
    }

    function updateXY(updating, url) {
        // Met a jour le statut en repetant cette requete
        // autant de fois que necessaire pour sortir de l'etat process succeeded
        var xhrResult = getXDomainRequest();
        // se connecte au fichier xml contenant le resultat du process et qui est mis a jour
        // au fur et a mesure du traitement
        xhrResult.open("GET", ajaxURL(url), true);
        xhrResult.addEventListener('readystatechange', function () {
            if (xhrResult.readyState === XMLHttpRequest.DONE && xhrResult.status === 200) {
                // recupere la reponse de l'url
                var xmlResult = xhrResult.responseXML;
                // recupere et met a jour le status du traitement
                var tagStatus = xmlResult.getElementsByTagName('wps:Status');
                var status = tagStatus[0].childNodes[1].nodeName;
                if (status !== 'wps:ProcessAccepted' && status !== 'wps:ProcessStarted') {
                    // arrete l'ecoute du status puisque le process est termine
                    clearInterval(updating);
                    if (status === 'wps:ProcessSucceeded') {
                        // identifie la balise de sortie
                        var docProcessOutputs = xmlResult.getElementsByTagName("wps:ProcessOutputs");
                        // recupere au format texte la partie du xml correspondant au resultat contenant les stations
                        for (var i = 0; i < docProcessOutputs[0].childNodes.length; i++) {
                            try {
                                var outputName = docProcessOutputs[0].childNodes[i].children[0].textContent
                                // Controle que nous sommes bien dans la balide correspondant au debit
                                if (outputName === 'XY') {
                                    var XYOnNetwork = docProcessOutputs[0].childNodes[i].children[2].children[0].textContent.split(" ");
                                    var p = ol.proj.transform(XYOnNetwork, 'EPSG:2154', 'EPSG:3857'),
                                        start = +new Date(),
                                        pan = ol.animation.pan({
                                            duration: 1000,
                                            source: view.getCenter(),
                                            start: start
                                        }),
                                        zoom = ol.animation.zoom({
                                            duration: 1000,
                                            source: view.getCenter(),
                                            resolution: view.getResolution(),
                                            start: start
                                        });
                                    marker.setPosition(p);
                                    map.beforeRender(pan, zoom);
                                    view.setCenter(p);
                                    $('#marker').show();

                                }
                            } catch (error) {
                                continue;
                            }
                        }
                    }
                }
            }
        });
        xhrResult.send();
    }


    function xyOnNetwork() {
        // recupere la coordonnee
        coord = positionToL93(marker.getPosition());
        var xhr = getXDomainRequest();
        // defini les parametres x,y du service
        datas = {
            [config.wps.datainputs.split("/")[0]]: [coord.split(',')[0]],
            [config.wps.datainputs.split("/")[1]]: [coord.split(',')[1]]
        };

        // construit la requete wps
        var rqtWPS = buildXmlRequest(config.wps.service, config.wps.version, config.wps.request, config.wps.idXyOnNetwork,
            datas, config.wps.storeExecuteResponse, config.wps.lineage, config.wps.status);

        xhr.open("POST", ajaxURL(config.wps.url_wps), true);
        xhr.addEventListener('readystatechange', function () {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                // Recupere le xml de la requete
                var xmlDoc = xhr.responseXML;
                var links = resultLink(xmlDoc, "xyOnStream");
                var updating = setInterval(function () {
                    updateXY(updating, links.url);
                }, config.wps.refreshTimeXY);
            }
        });
        xhr.send(rqtWPS);

    }

    function resultLink(xmlDoc, nameProcess) {
        // Recupere le tag et l'attribut contenant la page xml de resultat et cree un lien pour y acceder
        var tagExecute = xmlDoc.getElementsByTagName('wps:ExecuteResponse')[0];
        var locationXML = tagExecute.getAttribute("statusLocation");
        // Cree un lien hypertext avec target blank ayant pour nom celui renseigne auparavant
        // pour renvoyer au fichier xml contenant les resultats du wps
        var xmlResult = document.createElement("a");
        xmlResult.setAttribute("href", locationXML);
        xmlResult.setAttribute("target", "_blank");
        xmlResult.appendChild(document.createTextNode(nameProcess));

        // cree un object pour retourner l'url pour effectuer le suivi de l'evolution du
        // traitement et le lien hypertexte pour y acceder
        var returnedObject = {};
        returnedObject["url"] = locationXML;
        returnedObject["link"] = xmlResult;
        return returnedObject;
    }

    function setProgress(tagStatus, statusCell, downloadCell) {
        // Recupere le status de la requete wps et mets a jour
        // celle ci dans le tableau de bord si necessaire
        var status = tagStatus[0].childNodes[1];
        if (status.nodeName === 'wps:ProcessAccepted') {
            downloadCell.innerHTML = "<img src=\"http://geowww.agrocampus-ouest.fr/simfen/sviewer/css/images/process.gif\" \
                                            width=\"50px\" height=\"36px\">\
                                      <p>0&#37;</p>";
            statusCell.innerHTML = status.textContent;
            return 'Process Accepted';
        } else if (status.nodeName === 'wps:ProcessStarted') {
            var percent = status.getAttribute("percentCompleted");
            downloadCell.innerHTML = "<img src=\"http://geowww.agrocampus-ouest.fr/simfen/sviewer/css/images/process.gif\" \
                                            width=\"50px\" height=\"36px\">\
                                      <p>" + percent + "&#37;</p>";
            statusCell.innerHTML = status.textContent;
            return 'Process Accepted';
        } else if (status.nodeName === 'wps:ProcessSucceeded') {
            statusCell.innerHTML = 'Process Succeeded';
            return 'Process Succeeded';
        } else if (status.nodeName === 'wps:ProcessFailed') {
            downloadCell.innerHTML = "<p></p>";
            statusCell.innerHTML = 'Process Failed';
            return 'Process Failed';
        } else {
            downloadCell.innerHTML = "<p></p>";
            statusCell.innerHTML = 'Error';
            return 'Error';
        }
    }

    /*function setDownloadFile2(datas, nameProcess, downloadCell) {
            // formate la variable contenant les donnees au format json
            var jsonse = JSON.stringify(datas, null, "\t");
            var jsonseToCSV = ConvertToCSV(jsonse);
            var blob = new Blob([jsonseToCSV], {
                type: "text/csv"
            });
            var url = URL.createObjectURL(blob);
            // cree l'url de telechargement et lie le fichier blob a celui-ci
            // et l'joute dans le tableau de bord
            var dlJson = document.createElement("a");
            dlJson.setAttribute("href", url);
            dlJson.setAttribute("target", "_blank");
            dlJson.setAttribute("download", nameProcess + "_flow.csv");
            dlJson.appendChild(document.createTextNode("download"));
            downloadCell.id = nameProcess + "_dl";
            // test pour ne pas ajouter plusieurs lien de telechargement dans la meme
            // cellule si une requete est trop longue a s'executer
            var element = document.getElementById(nameProcess + "_dl")
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
            if (element.childNodes.length === 0) {
                element.appendChild(dlJson);
            }
        }
    */

    function setDownloadFile(datasx, datasy, nameProcess, downloadCell) {
        // header of csvfile
        var str = 'date;runoff' + '\r\n';

        // construit chaque ligne du csv selon les donnees
        for (var i = 0; i < datasx.length; i++) {
            var line = '';
            line += datasx[i] + ";" + datasy[i]
            str += line + '\r\n';
        }

        // cree le csv
        var blob = new Blob([str], {
            type: "text/csv"
        });
        var url = URL.createObjectURL(blob);
        // cree l'url de telechargement et lie le fichier blob a celui-ci
        // et l'joute dans le tableau de bord
        var dlJson = document.createElement("a");
        dlJson.setAttribute("href", url);
        dlJson.setAttribute("target", "_blank");
        dlJson.setAttribute("download", nameProcess + "_flow.csv");
        dlJson.appendChild(document.createTextNode("download"));
        downloadCell.id = nameProcess + "_dl";
        // test pour ne pas ajouter plusieurs lien de telechargement dans la meme
        // cellule si une requete est trop longue a s'executer
        var element = document.getElementById(nameProcess + "_dl")
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        if (element.childNodes.length === 0) {
            element.appendChild(dlJson);
        }
    }

    function setInputStations(listStations, nameProcess, downloadCell) {
        // cree l'url de telechargement et lie le fichier blob a celui-ci
        // et l'joute dans le tableau de bord
        var inputStation = document.createElement("INPUT");
        inputStation.setAttribute("type", "text");
        inputStation.setAttribute("value", listStations);
        inputStation.setAttribute("size", 5);
        inputStation.setAttribute("id", nameProcess + "_inputStation");
        inputStation.appendChild(document.createTextNode("listStations"));
        downloadCell.id = nameProcess + "_Stations";
        // test pour ne pas ajouter plusieurs lien de telechargement dans la meme
        // cellule si une requete est trop longue a s'executer
        var element = document.getElementById(nameProcess + "_Stations")
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        if (element.childNodes.length === 0) {
            element.appendChild(inputStation);
        }
    }

    function StringToXMLDom(string) {
        var xmlDoc = null;
        if (window.DOMParser) {
            parser = new DOMParser();
            xmlDoc = parser.parseFromString(string, "text/xml");
        } else // Internet Explorer
        {
            xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = "false";
            xmlDoc.loadXML(string);
        }
        return xmlDoc;
    }

    function plotStation(xmlResponse, downloadCell, nameProcess) {
        /*recupere dans le document xml les informations spatiales des stations
        pour ensuite les afficher sur la carte. Si une couche de station a deja ete
        produite, la supprime avant*/

        function pointStyleFunctionSelected(feature) {
            return new ol.style.Style({
                image: new ol.style.Circle({
                    fill: new ol.style.Fill({
                        color: 'rgba(0, 200, 0, 1)'
                    }),
                    stroke: new ol.style.Stroke({
                        width: 1,
                        color: 'rgba(0, 200, 0, 1)'
                    }),
                    radius: 7
                }),
                text: createTextStyle(feature)
            });
        }

        function pointStyleFunctionUnselected(feature) {
            return new ol.style.Style({
                image: new ol.style.Circle({
                    fill: new ol.style.Fill({
                        color: 'rgba(200, 0, 0, 1)'
                    }),
                    stroke: new ol.style.Stroke({
                        width: 1,
                        color: 'rgba(200, 0, 0, 1)'
                    }),
                    radius: 7
                }),
                text: createTextStyle(feature)
            });
        }

        var createTextStyle = function (feature) {
            return new ol.style.Text({
                font: '12px Calibri,sans-serif',
                text: feature.get('name'),
                offsetY: 20,
                fill: new ol.style.Fill({
                    color: '#000'
                }),
                stroke: new ol.style.Stroke({
                    color: '#fff',
                    width: 5
                })
            });
        };

        // identifie la balise de sortie
        var docProcessOutputs = xmlResponse.getElementsByTagName("wps:ProcessOutputs");
        // supprime la precedente couche de station si elle existe
        var layersToRemove = [];
        map.getLayers().forEach(function (layer) {
            if (layer.get('name') != undefined && (layer.get('name') === 'stations' || layer.get('name') === 'stations2')) {
                layersToRemove.push(layer);
            }
        });
        var len = layersToRemove.length;
        for (var i = 0; i < len; i++) {
            map.removeLayer(layersToRemove[i]);
        }

        // recupere au format texte la partie du xml correspondant au resultat contenant les stations
        for (var i = 0; i < docProcessOutputs[0].childNodes.length; i++) {
            try {
                var outputName = docProcessOutputs[0].childNodes[i].children[0].textContent

                // Controle que nous sommes bien dans la balide correspondant au debit
                if (outputName === 'Stations' || outputName === 'Stations2') {
                    var gmlStations = docProcessOutputs[0].childNodes[i].children[2].outerHTML;
                    // converti la chaine de texte en objet xml
                    var gmlStationsXML = StringToXMLDom(gmlStations);
                    // pour chaque entite (station)
                    var features = gmlStationsXML.getElementsByTagName("gml:featureMember");

                    // initialise la source de donnees qui va contenir les entites
                    var stationSource = new ol.source.Vector({});

                    // cree le vecteur qui va contenir les stations
                    if (outputName === 'Stations') {
                        var arrStations = new Array();
                        var stationLayer = new ol.layer.Vector({
                            name: "stations",
                            source: stationSource,
                            style: pointStyleFunctionSelected
                        });
                    } else if (outputName === 'Stations2') {
                        //alert("station2");
                        var stationLayer = new ol.layer.Vector({
                            name: "stations2",
                            source: stationSource,
                            style: pointStyleFunctionUnselected
                        });
                    }

                    // pour chaque entite
                    for (var j = 0; j < features.length; j++) {
                        // recupere sa coordonnees et son nom
                        coord = gmlStationsXML.getElementsByTagName("gml:coordinates")[j].textContent.split(",");

                        nameStation = gmlStationsXML.getElementsByTagName("ogr:code_hydro")[j].textContent;

                        if (outputName === 'Stations') {
                            arrStations.push(nameStation);
                        }

                        // cree le point en veillant a changer la projection
                        var featureGeom = new ol.geom.Point(ol.proj.transform([coord[0], coord[1]], 'EPSG:2154', 'EPSG:3857'));
                        // cree la feature
                        var featureThing = new ol.Feature({
                            name: nameStation,
                            geometry: featureGeom
                        });
                        // ajoute la feature a la source
                        stationSource.addFeature(featureThing);
                    }
                    // ajoute la couche de point des stations a la carte
                    map.addLayer(stationLayer);
                    setInputStations(arrStations, nameProcess, downloadCell);
                }
            } catch (error) {
                continue;
            }
        }
    }


    function plotDlDatas(xmlResponse, nameProcess, downloadCell) {
        // Recupere uniquement les datas du child correspondant au debit
        var docProcessOutputs = xmlResponse.getElementsByTagName("wps:ProcessOutputs");
        for (var i = 0; i < docProcessOutputs[0].childNodes.length; i++) {
            try {
                // Controle que nous sommes bien dans la balide correspondant au debit
                if (docProcessOutputs[0].childNodes[i].children[0].textContent === 'WaterML') {
                    // recupere les donnees dans la balise wps:Data
                    var stringWaterML = docProcessOutputs[0].childNodes[i].children[2].innerHTML;
                    var docWaterML = StringToXMLDom(stringWaterML);
                    var points = docWaterML.getElementsByTagName("wml2:point");
                }
            } catch (error) {
                continue;
            }
        }

        var xDatas = [];
        var yDatas = [];
        for (var i = 0; i < points.length; i++) {
            xDatas = xDatas.concat(points[i].childNodes[1].children[0].textContent);
            yDatas = yDatas.concat(points[i].childNodes[1].children[1].textContent);
        }

        // cree un fichier contenant les donnees au format csv
        // et permet son telechargement
        setDownloadFile(xDatas, yDatas, nameProcess, downloadCell);

        var trace = {
            name: nameProcess,
            x: xDatas,
            y: yDatas,
            type: 'scatter',
        };

        var layout = {
            title: "Simulation flow",
            xaxis: {
                title: 'Date',
            },
            yaxis: {
                title: 'm3/s'
            },
            showlegend: true,
            legend: {
                "orientation": "h"
            }
        };

        var plotDatas = [trace];
        Plotly.react('graphFlowSimulated', plotDatas, layout);
    }

    /*function plotDlDatasjson(xmlResponse, nameProcess, downloadCell) {
        // Recupere uniquement les datas du child correspondant au debit
        var docProcessOutputs = xmlResponse.getElementsByTagName("wps:ProcessOutputs");
        for (var i = 0; i < docProcessOutputs.length; i++) {
            try {
                // Controle que nous sommes bien dans la balide correspondant au debit
                if (docProcessOutputs[i].childNodes[1].children[0].textContent === 'Flow') {
                    // recupere les donnees dans la balise wps:Data
                    var datasJson = docProcessOutputs[i].childNodes[1].children[2].textContent;
                }
            } catch (error) {
                break;
            }
        }

        var datas = JSON.parse(datasJson);

        // cree un fichier contenant les donnees au format csv
        // et permet son telechargement
        setDownloadFile(datas, nameProcess, downloadCell);

        var xDatas = [];
        var yDatas = [];
        for (var i = 0; i < datas.length; i++) {
            xDatas = xDatas.concat(datas[i]["date"]);
            yDatas = yDatas.concat(datas[i]["runoff"]);
        }

        var trace = {
            name: nameProcess,
            x: xDatas,
            y: yDatas,
            type: 'scatter',
        };

        var layout = {
            title: "Simulation flow",
            xaxis: {
                title: 'Date',
            },
            yaxis: {
                title: 'm3/s'
            },
            showlegend: true,
            legend: {
                "orientation": "h"
            }
        };

        var plotDatas = [trace];
        Plotly.react('graphFlowSimulated', plotDatas, layout);
    }*/

    function dashboard() {
        // Se connecte au tableau de bord
        var tableRef = document.getElementById('panelWPS').getElementsByTagName('tbody')[0];
        // Insert a row in the table at the last row
        var newRow = tableRef.insertRow(tableRef.rows.length);
        // Insert a cell in the row at index 0
        var linkCell = newRow.insertCell(0);
        var statusCell = newRow.insertCell(1);
        var downloadCell = newRow.insertCell(2);

        return [linkCell, statusCell, downloadCell];
    }

    function updateProcess(updating, url, statusCell, downloadCell, nameProcess, idProcess) {
        // Met a jour le statut en repetant cette requete
        // autant de fois que necessaire pour sortir de l'etat process succeeded
        var xhrResult = getXDomainRequest();
        // se connecte au fichier xml contenant le resultat du process et qui est mis a jour
        // au fur et a mesure du traitement
        xhrResult.open("GET", ajaxURL(url), true);
        xhrResult.addEventListener('readystatechange', function () {
            if (xhrResult.readyState === XMLHttpRequest.DONE && xhrResult.status === 200) {
                // recupere la reponse de l'url
                var xmlResult = xhrResult.responseXML;
                // recupere et met a jour le status du traitement
                var tagStatus = xmlResult.getElementsByTagName('wps:Status');
                var etatStatus = setProgress(tagStatus, statusCell, downloadCell);
                var status = tagStatus[0].childNodes[1].nodeName;
                if (status !== 'wps:ProcessAccepted' && status !== 'wps:ProcessStarted') {
                    // arrete l'ecoute du status puisque le process est termine
                    clearInterval(updating);
                    if (status === 'wps:ProcessSucceeded') {
                        if (idProcess == config.wps.idCalcModel) {
                            // Affiche les stations employees
                            plotStation(xmlResult, downloadCell, nameProcess);
                            // cree un graphique d'apres le resultat et mets en place un lien de telechargement
                            plotDlDatas(xmlResult, nameProcess, downloadCell);
                        } else if (idProcess == config.wps.idGetStation || idProcess == config.wps.idCalcGhosh) {
                            // Affiche les stations employees
                            plotStation(xmlResult, downloadCell, nameProcess);
                        }
                    }
                }
            }
        });
        xhrResult.send();
    }

    function processExe(xhr, rqtWPS, idProcess) {
        xhr.open("POST", ajaxURL(config.wps.url_wps), true);
        xhr.addEventListener('readystatechange', function () {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                // Recupere le xml de la requete
                var xmlDoc = xhr.responseXML;
                // Se connecte au tableau de bord
                var cells = dashboard();
                // Ajoute l'url du resultat dans cette cellule
                var links = resultLink(xmlDoc, $("#nameProcess").val());
                // defini l'id unique de la requete selon l'url du resultat
                cells[0].id = links.link;
                document.getElementById(links.link).appendChild(links.link);
                // Recupere le status du process
                var tagStatus = xmlDoc.getElementsByTagName('wps:Status');
                var etatStatus = setProgress(tagStatus, cells[1], cells[2]);
                var updating = setInterval(function () {
                    updateProcess(updating, links.url, cells[1], cells[2], $("#nameProcess").val(), idProcess);
                }, config.wps.refreshTime);
            }
        });
        xhr.send(rqtWPS);
    }

    function buildXmlRequest(service, version, request, identifier, inputs, SER, lineage, status) {
        var xmlRequest = sprintf('<?xml version="1.0" encoding="UTF-8"?>\
            <wps:%s xmlns:ows="http://www.opengis.net/ows/1.1" xmlns:wps="http://www.opengis.net/wps/1.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="%s" service="%s" xsi:schemaLocation="http://www.opengis.net/wps/1.0.0 http://schemas.opengis.net/wps/1.0.0/wpsAll.xsd">\
            <ows:Identifier>%s</ows:Identifier>\
            <wps:DataInputs>\
            ', request, version, service, identifier);

        for (key in inputs) {
            inputXml = sprintf('\
            <wps:Input>\
            <ows:Identifier>%s</ows:Identifier>\
            <wps:Data>\
            <wps:LiteralData>%s</wps:LiteralData>\
            </wps:Data>\
            </wps:Input>', key, inputs[key]);
            xmlRequest += inputXml;
        }

        xmlRequest += sprintf('\
              </wps:DataInputs>\
               <wps:ResponseForm>\
                <wps:ResponseDocument storeExecuteResponse="%s" lineage="%s" status="%s">\
                </wps:ResponseDocument>\
               </wps:ResponseForm>\
              </wps:%s>', SER, lineage, status, request);

        return xmlRequest;
    }

    function wpsExe() {
        // permet de controler les donnees dans le formulaire
        $('#wpsForm').validate({
            debug: true,
            rules: {
                dateStart: {
                    required: true,
                    minlength: 10,
                    maxlength: 10
                },
                dateEnd: {
                    required: true,
                    minlength: 10,
                    maxlength: 10
                },
                nameProcess: {
                    required: true,
                    maxlength: 75
                }
            },
            // recupere toutes les donnees dans le formulaire et execute le process
            submitHandler: function (form) {
                coord = positionToL93(marker.getPosition());
                var xhr = getXDomainRequest();

                // Test pour savoir s'il ne faut utiliser que les stations incluses dans le
                // bassin cible
                if ($("input[name='inBasin']")[0].checked) {
                    inBasin = "True";
                } else {
                    inBasin = "False";
                }
                var idProcess = $(this.submitButton).attr("value");
                if (idProcess == config.wps.idGetStation) {
                    datas = {
                        [config.wps.datainputs.split("/")[0]]: [coord.split(',')[0]],
                        [config.wps.datainputs.split("/")[1]]: [coord.split(',')[1].slice(1)],
                        [config.wps.datainputs.split("/")[2]]: [$("#dateStart").val()],
                        [config.wps.datainputs.split("/")[3]]: [$("#dateEnd").val()],
                        [config.wps.datainputs.split("/")[4]]: [$("#nameProcess").val().replace(/ /g, "_").replace(/-/g, "_")],
                        [config.wps.datainputs.split("/")[8]]: [$("#distance").val()],
                        [config.wps.datainputs.split("/")[7]]: [$("#listStations").val()]
                    };

                    var rqtWPS = buildXmlRequest(config.wps.service, config.wps.version, config.wps.request, config.wps.idGetStation,
                        datas, config.wps.storeExecuteResponse, config.wps.lineage, config.wps.status);
                    
                } else if (idProcess == config.wps.idCalcModel) {
                    datas = {
                        [config.wps.datainputs.split("/")[0]]: [coord.split(',')[0]],
                        [config.wps.datainputs.split("/")[1]]: [coord.split(',')[1].slice(1)],
                        [config.wps.datainputs.split("/")[2]]: [$("#dateStart").val()],
                        [config.wps.datainputs.split("/")[3]]: [$("#dateEnd").val()],
                        [config.wps.datainputs.split("/")[4]]: [$("#nameProcess").val().replace(/ /g, "_").replace(/-/g, "_")],
                        [config.wps.datainputs.split("/")[5]]: [$("input[name='deltaT']:checked").val()],
                        [config.wps.datainputs.split("/")[6]]: [inBasin]
                    };

                    var rqtWPS = buildXmlRequest(config.wps.service, config.wps.version, config.wps.request, config.wps.idCalcModel,
                        datas, config.wps.storeExecuteResponse, config.wps.lineage, config.wps.status);

                } else if (idProcess == config.wps.idCalcGhosh) {
                    datas = {
                        [config.wps.datainputs.split("/")[0]]: [coord.split(',')[0]],
                        [config.wps.datainputs.split("/")[1]]: [coord.split(',')[1].slice(1)],
                        [config.wps.datainputs.split("/")[2]]: [$("#dateStart").val()],
                        [config.wps.datainputs.split("/")[3]]: [$("#dateEnd").val()],
                        [config.wps.datainputs.split("/")[4]]: [$("#nameProcess").val().replace(/ /g, "_").replace(/-/g, "_")],
                        [config.wps.datainputs.split("/")[6]]: [inBasin],
                        [config.wps.datainputs.split("/")[7]]: [$("#listStations").val()]
                        //[config.wps.datainputs.split("/")[7]]: [document.getElementById($("#nameProcess").val().replace(/ /g, "_").replace(/-/g, "_") + "_inputStation").value]
                    };

                    var rqtWPS = buildXmlRequest(config.wps.service, config.wps.version, config.wps.request, config.wps.idCalcGhosh,
                        datas, config.wps.storeExecuteResponse, config.wps.lineage, config.wps.status);

                }

                processExe(xhr, rqtWPS, idProcess);

            },
            messages: {
                dateStart: {
                    required: tr("Date mandatory")
                },
                dateEnd: {
                    email: tr("Date mandatory")
                },
                nameProcess: tr("Name mandatory")
            }
        });
    }

    /**
     * method: feedbackForm
     * use retrodata service to record user feedback
     */
    function feedbackForm() {
        var minlength = 3,
            maxlength = 200;

        /* CGU */
        $('#feedbackGCUURL').attr('href', config.retrodata.url_gcu);

        /* tooltip over feedbacks */
        var bubble = $('.sv-feedbackTip')[0];
        var feedbackTip = new ol.Overlay({
            element: bubble,
            positioning: 'bottom-center',
            stopEvent: false
        });
        map.addOverlay(feedbackTip);

        // display tooltip on hover or click
        map.on('pointermove', function (e) {
            var feature = map.forEachFeatureAtPixel(e.pixel,
                function (feature) {
                    return feature;
                });
            if (feature) {
                var content = $('<div />')
                // KML
                content.append($('<p />').html(feature.get('description')));
                // feedback
                content.append($('<p class="sv-date" />').html(feature.get('datetime').split('.')[0]));
                content.append($('<p class="sv-comment" />').html(feature.get('sv_comment')));
                feedbackTip.setPosition(e.coordinate);
                $(bubble).empty()
                    .append(content)
                    .show();
            } else {
                $(bubble).html('');
                $(bubble).hide();
            }
        });

        $('#feedbackForm').validate({
            debug: true,
            rules: {
                feedbackComment: {
                    required: true,
                    minlength: minlength,
                    maxlength: maxlength
                },
                feedbackEmail: {
                    email: true
                },
                feedbackGCU: {
                    required: true
                }
            },
            submitHandler: function (form) {
                var geojson = new ol.format.GeoJSON(),
                    feature = new ol.Feature({
                        "sv:title": config.title,
                        "sv:email": $('#feedbackEmail').val(),
                        "sv:comment": $('#feedbackComment').val(),
                        "sv:permalink": buildPermalink()
                    }),
                    p = marker.getPosition();
                if (p) {
                    feature.setGeometry(new ol.geom.Point(ol.proj.transform(marker.getPosition(), projcode, 'EPSG:4326')));
                }
                $.ajax({
                    url: ajaxURL(config.retrodata.url),
                    type: "POST",
                    contentType: 'application/json',
                    dataType: "json",
                    data: JSON.stringify({
                        "type": "FeatureCollection",
                        "features": [geojson.writeFeatureObject(feature)]
                    }),
                    success: function (response) {
                        if (response.result === "success") {
                            messagePopup(tr('Comment saved. Thanks for your contribution.'));
                            feedbackLayerUpdate();
                            $(form).trigger('reset');
                        } else {
                            messagePopup(tr('Error submitting your comment. Please try again.'));
                        }
                    },
                    error: function (reponse) {
                        messagePopup(tr('Error submitting your comment. Please try again.'));
                    }
                });
            },
            messages: {
                feedbackComment: {
                    required: tr("comment is mandatory"),
                    minlength: tr("at least {0} characters required"),
                    maxlength: tr("at most {0} characters required")
                },
                feedbackMail: {
                    email: tr("invalid email address")
                },
                feedbackGCU: tr("you must accept the conditions before submitting your comment")
            }
        });
    }

    /**
     * method: feedbackLayer
     * display retrodata features on map, filtered by map title
     */
    function feedbackLayerUpdate() {
        config.retrodata.layer.setSource(
            new ol.source.Vector({
                projection: 'EPSG:4326',
                url: ajaxURL(config.retrodata.url_wfs + $.param({
                    'SERVICE': 'WFS',
                    'VERSION': "2.0.0",
                    'REQUEST': 'getFeature',
                    'TYPENAME': config.retrodata.featuretype,
                    'OUTPUTFORMAT': 'json',
                    /* using CQL_FILTER for POC */
                    'CQL_FILTER': "sv_title='" + escHTML(config.title.replace("'", "\\'")) + "'"
                })),
                format: new ol.format.GeoJSON()
            })
        );
        map.getLayers().setAt(map.getLayers().getArray().length, config.retrodata.layer)
        config.retrodata.layer.setVisible(true);
    }

    /**
     * method: feedbackLayer
     * display retrodata features on map, filtered by map title
     */
    function feedbackLayerHide() {
        config.retrodata.layer.setVisible(false);
    }

    /**
     * method: searchPlace
     * search for matching places (OpenLS) and features
     */
    function searchPlace() {
        $("#searchResults").html("");
        try {
            openLsRequest($("#searchInput").val());
            if (config.search) {
                searchFeatures($("#searchInput").val());
            }
        } catch (err) {
            messagePopup(tr('Geolocation failed'));
            $.mobile.loading('hide');
        }
        return false;
    }

    // panel size and placement to fit small screens
    function panelLayout(e) {
        var panel = $(this);
        panel.css('max-width', Math.min($(window).width() - 44, 450) + 'px');
        panel.css('max-height', $(window).height() - 64 + 'px');
    }

    // visible popup = highlight button
    function panelToggle(e) {
        $.each($("#panelcontrols a"), function () {
            var id = this.href.split('#', 2)[1];
            $(this).toggleClass('ui-btn-active', ($("#" + id).css('visibility') == 'visible'));
        });
    }

    // bypass popup behavior
    function panelButton(e) {
        var idOn = e.target.href.split('#', 2)[1];
        $.each($('#panelcontrols a'), function () {
            var id = this.href.split('#', 2)[1];
            if (id != idOn) {
                $('#' + id).popup('close');
            } else {
                $('#' + id).popup('open');
            }
        });
    }

    // updates title
    function setTitle(title) {
        config.title = title;
        document.title = config.title;
        if (config.title !== '') {
            $('#panelShareBtn').text(config.title);
        }
        if ($("#setTitle").val() === '') {
            $("#setTitle").val(config.title);
        }
    }

    // updates title on keypress
    function onTitle(e) {
        setTitle($("#setTitle").val());
    }

    // Zoom +
    function zoomIn() {
        var zoom = ol.animation.zoom({
            duration: 500,
            source: view.getCenter(),
            resolution: view.getResolution()
        });
        map.beforeRender(zoom);
        view.setZoom(view.getZoom() + 1);
    }

    //Zoom -
    function zoomOut() {
        var zoom = ol.animation.zoom({
            duration: 500,
            source: view.getCenter(),
            resolution: view.getResolution()
        });
        map.beforeRender(zoom);
        view.setZoom(view.getZoom() - 1);
    }

    // Back to initial extent
    function zoomInit() {
        var start = +new Date();
        var pan = ol.animation.pan({
            duration: 500,
            source: view.getCenter(),
            start: start
        });
        var zoom = ol.animation.zoom({
            duration: 500,
            source: view.getCenter(),
            resolution: view.getResolution(),
            start: start
        });
        map.beforeRender(pan, zoom);
        view.fit(config.initialExtent, map.getSize());
        view.setRotation(0);
    }

    // recenter on device position
    function showPosition(pos) {
        var p = ol.proj.transform([pos.coords.longitude, pos.coords.latitude], 'EPSG:4326', config.projcode),
            start = +new Date(),
            pan = ol.animation.pan({
                duration: 1000,
                source: view.getCenter(),
                start: start
            }),
            zoom = ol.animation.zoom({
                duration: 1000,
                source: view.getCenter(),
                resolution: view.getResolution(),
                start: start
            });
        marker.setPosition(p);
        map.beforeRender(pan, zoom);
        view.setCenter(p);
        if (view.getZoom() < 17) view.setZoom(18);
    }

    // get device position
    function locateMe() {
        if (navigator.geolocation) {
            messagePopup(tr("estimating device position ..."));
            navigator.geolocation.getCurrentPosition(
                showPosition,
                function (e) {
                    messagePopup(tr("device position error"));
                }, {
                    maximumAge: 60000,
                    enableHighAccuracy: true,
                    timeout: 30000
                }
            );
        } else {
            messagePopup(tr("device position not available on this device"));
        }
        return false;
    }

    //  info popup
    function messagePopup(msg) {
        $("<div class='ui-loader ui-overlay-shadow ui-body-e ui-corner-all'>")
            .append($('<h3>').text(msg))
            .css({
                display: "block",
                position: "fixed",
                padding: "7px",
                "text-align": "center",
                "background-color": "#ffffff",
                width: "270px",
                left: ($(window).width() - 284) / 2,
                top: $(window).height() / 2
            })
            .appendTo($.mobile.pageContainer).delay(1500)
            .fadeOut(1000, function () {
                $(this).remove();
            });
    }

    // ----- configuration --------------------------------------------------------------------------------

    /**
     * reads optional "c" querystring arg,
     * loads application profile located in etc/customConfig_[configname].js
     * ie &c=cadastral& : loads etc/customConfig_cadastral.js instead of customConfig.js
     * configname MUST MATCH ^[A-Za-z0-9_-]+$
     */
    function init() {
        var qsconfig;
        if (qs.c && qs.c.match(/^[A-Za-z0-9_-]+$/)) {
            qsconfig = "etc/customConfig_" + qs.c + ".js";
        } else {
            qsconfig = "etc/customConfig.js";
        }
        $.getScript(qsconfig)
            .done(function () {
                // transmits config name for persistency
                customConfig.customConfigName = qs.c;
                doConfiguration();
                doTimeline();
                doMap();
                doGUI();
            })
            .fail(function () {
                doConfiguration();
                doTimeline();
                doMap();
                doGUI();
            });
    }

    /**
     * reads configuration from querystring
     */
    function doConfiguration() {

        // browser language
        var language = ((navigator.language) ? navigator.language : navigator.userLanguage).substring(0, 2);

        // current config
        config = {
            lang: ((hardConfig.i18n.hasOwnProperty(language)) ? language : 'en'),
            wmc: '',
            lb: 0,
            layersQueryable: [],
            layersQueryString: '',
            dates: null
        };
        $.extend(config, hardConfig);
        $.extend(config, customConfig);
        config.projection = ol.proj.get(config.projcode);

        // dates for WMS TIME enabled datasets
        config.dates = new vis.DataSet(options = {
            queue: true,
            autoResize: true
        });
        if (qs.time) {
            config.time = new Date(qs.time);
        }

        // querystring param: lb (selected background)
        if (qs.lb) {
            config.lb = parseInt(qs.lb) % config.layersBackground.length;
        }

        // querystring param: map id
        if (qs.wmc) {
            config.wmc = qs.wmc;
        }

        // querystring param: layers
        if (qs.layers) {
            config.layersQueryString = qs.layers;
            var ns_layer_style_list = [];
            // parser to retrieve serialized namespace:name[*style[*cql_filter]] and store the description in config
            ns_layer_style_list = (typeof qs.layers === 'string') ? qs.layers.split(',') : qs.layers;
            $.each(ns_layer_style_list, function () {
                config.layersQueryable.push(new LayerQueryable(this));
            });
        }

        // querystring param: qcl_filters
        if (qs.qcl_filters) {
            var qcl_filters_list = [];
            qcl_filters_list = (typeof qs.qcl_filters === 'string') ? qs.qcl_filters.split(';') : qs.qcl_filters;

            $.each(qcl_filters_list, function (index) {
                if (index < config.layersQueryable.length) {
                    var opt = config.layersQueryable[index].options;
                    opt.cql_filter = this;
                    config.layersQueryable[index] = new LayerQueryable(opt);
                }
            });
        }

        // querystring param: xyz
        // recenters map on specified location
        if (qs.x && qs.y && qs.z) {
            config.z = parseInt(qs.z);
            var p = [parseFloat(qs.x), parseFloat(qs.y)];
            // is this lonlat ? anyway don't use sviewer for the vendee globe
            if (Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 180 && config.z > 7) {
                p = ol.proj.transform(p, 'EPSG:4326', config.projcode);
            }
            config.x = p[0];
            config.y = p[1];
        }

        // querystring param: title
        // controls map title
        if (qs.title) {
            setTitle(qs.title);
        } else {
            setTitle(config.title);
        }

        // querystring param: kml overlay url
        if (qs.kml) {
            config.kmlUrl = qs.kml;
        }

        // querystring param: perform getFeatureInfo on map center
        if (qs.q) {
            config.gfiok = true;
        }

        // querystring param: activate search based on layer text attributes
        if (qs.s) {
            config.search = true;
            config.searchparams = {};
            $("#addressForm label").text('Features or ' + $("#addressForm label").text());
        }

    }


    /**
     * creates the timeline
     */
    function doTimeline() {
        config.timeline = new vis.Timeline(
            $('#timeline')[0],
            config.dates,
            options = {});
        // on date select, refresh time enabled layers
        config.timeline.on('select', function (properties) {
            setTimeAll(config.dates.get(properties.items[0]).start);
        });
    }

    /**
     * creates the map
     */
    function doMap() {
        // map creation
        view = new ol.View({
            projection: config.projection
        });
        map = new ol.Map({
            controls: [
                new ol.control.ScaleLine(),
                new ol.control.Attribution()
            ],
            layers: [],
            overlays: [],
            target: 'map',
            view: view
        });

        // adding background layers (opaque, non queryable, mutually exclusive)
        $.each(config.layersBackground, function () {
            this.setVisible(false);
            map.addLayer(this);
        });
        switchBackground(config.lb);

        // adding WMS layers from georchestra map (WMC)
        // try wmc=58a713a089cf408419b871b73110b7cb on dev.geobretagne.fr
        if (config.wmc) {
            parseWMC(config.wmc);
        }

        // adding queryable WMS layers from querystring
        $.each(config.layersQueryable, function () {
            map.addLayer(this.wmslayer);
        });

        //activate search for WMS layer (origin : ?layers=...)
        if (config.search && config.layersQueryable.length > 0) {
            activateSearchFeatures('remote');
        }

        // adding custom kml overlay
        if (config.kmlUrl) {
            config.kmlLayer = new ol.layer.Vector({
                source: new ol.source.Vector({
                    projection: 'EPSG:4326',
                    url: ajaxURL(config.kmlUrl),
                    format: new ol.format.KML()
                })
            });
            map.addLayer(config.kmlLayer);

            //activate search for kml layer (origin : ?kml=...)
            if (config.search) {
                activateSearchFeatures('local');
            }
        }

        // adding retrodata overlay
        if (config.retrodata) {
            config.retrodata.layer = new ol.layer.Vector({
                style: new ol.style.Style({
                    image: new ol.style.Icon({
                        anchor: [0.5, 0.5],
                        anchorXUnits: 'fraction',
                        anchorYUnits: 'fraction',
                        src: 'css/images/retrodata.png'
                    })
                })
            });
            map.addLayer(config.retrodata.layer);
        }

        // map recentering
        if (config.x && config.y && config.z) {
            view.setCenter([config.x, config.y]);
            view.setZoom(config.z);
        } else {
            view.fit(config.initialExtent, map.getSize());
            view.setRotation(0);
        }

        // marker overlay for geoloc and queries
        marker = new ol.Overlay({
            element: $('#marker')[0],
            positioning: 'bottom-left',
            stopEvent: false
        });
        map.addOverlay(marker);
    }

    /**
     * initiates GUI
     */
    function doGUI() {
        // opens permalink tab if required
        if (qs.qr) {
            setPermalink();
            $('#panelShare').popup('open');
        }

        // map events
        map.on('singleclick', function (e) {
            queryMap(e.coordinate);
            xyOnNetwork();
            $('#panelWPS').popup('open');
        });

        map.on('moveend', setPermalink);
        $('#marker').click(clearQuery);

        // map buttons
        $('#ziBt').click(zoomIn);
        $('#zoBt').click(zoomOut);
        $('#zeBt').click(zoomInit);
        $('#bgBt').click(switchBackground);

        // geolocation form
        $('#zpBt').click(locateMe);
        $('#addressForm').on('submit', searchPlace);

        // set title dialog
        $('#setTitle').keyup(onTitle);
        $('#setTitle').blur(setPermalink);

        // sendto form
        $('#georchestraForm').submit(function (e) {
            sendMapTo('georchestra_viewer');
        });

        // wps form
        if (config.hasOwnProperty('wps')) {
            wpsExe();
        }

        // feedback form handled by validation plugin,
        // activated if config.retrodata.url is valid
        if (config.hasOwnProperty('retrodata')) {
            if (config.retrodata.hasOwnProperty('url')) {
                $('#panelFeedbackBtn').show();
                feedbackForm();
                $('.sv-panelfeedback').bind('popupafteropen', feedbackLayerUpdate)
                    .bind('popupafterclose', feedbackLayerHide);
            }
        }

        // dynamic resize
        $(window).bind('orientationchange resize pageshow updatelayout', panelLayout);
        $('.sv-panel').bind('popupbeforeposition popupafteropen', panelLayout);
        $.each($('.sv-panel'), panelLayout);

        // panel events
        $('.sv-panel').bind('popupafteropen', setPermalink);
        $('.sv-panel').bind('popupafterclose popupafteropen', panelToggle);
        $('#panelcontrols a').bind('click', panelButton);

        // i18n
        if (config.lang !== 'en') {
            translateDOM('.i18n', ['title', 'placeholder', 'value']);
        }

        // resize map
        $(window).bind("orientationchange resize pageshow", fixContentHeight);
        fixContentHeight();

        if (config.gfiok && (!(config.wmc.length > 0))) {
            setTimeout(
                function () {
                    queryMap(view.getCenter());
                },
                300
            );
        }
    }


    // ------ Main ------------------------------------------------------------------------------------------

    init();

};


$(document).ready(SViewer);
