customConfig = {

    /**
     * configuration pour inventaire des cours d'eau 35
     * voir : DDTM35/METSSI
     */

    title: 'GeoBretagne carte contributive',

    /**
     * default language, see etc/i18n.js
     */
    lang: 'fr',

    /**
     * base url of the geOrchetra SDI. Layers coming from this SDI
     * will have enhanced features.
     */
    geOrchestraBaseUrl: 'https://geobretagne.fr/',

    /**
     * projection
     */
    projcode: 'EPSG:3857',

    /**
     * map bounds
     */
    initialExtent: [-12880000,-1080000,5890000,7540000],
    maxExtent: [-20037508.34, -20037508.34, 20037508.34, 20037508.34],
    restrictedExtent: [-20037508.34, -20037508.34, 20037508.34, 20037508.34],

    /**
     * getFeatureInfo control
     */
    maxFeatures: 10,
    nodata: '<!--nodatadetect-->\n<!--nodatadetect-->',

    /**
     * openLS control
     */
    openLSGeocodeUrl: "https://geobretagne.fr/openls?",

/**
     * background layers (EPSG:3857)
     */
    layersBackground: [
        // carte simple
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                attributions: [new ol.Attribution({
                    html: 'carte <a href="https://geobretagne.fr/geonetwork/apps/georchestra/?uuid=3303a14b-44af-4950-b067-f43ddc0f483f">GéoBretagne</a>,' +
                        'données contributeurs <a href="http://www.openstreetmap.org/">OpenStreetMap</a> <a href="http://www.openstreetmap.org/copyright">ODbL</a>'
                })],
                url: 'http://osm.geobretagne.fr/gwc01/service/tms/1.0.0/osm:map@EPSG%3A3857@jpeg/{z}/{x}/{-y}.png',
            })
        }),


        // photo & routes
        new ol.layer.Group({
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.WMTS({
                        attributions: [new ol.Attribution({
                            html: 'rendu <a href="https://geobretagne.fr/geonetwork/apps/georchestra/?uuid=3a0ac2e3-7af1-4dec-9f36-dae6b5a8c731">GéoBretagne</a>, données &copy NASA, PlanetObserver, IGN, e-Megalis et collectivités'
                        })],
                        url: 'http://tile.geobretagne.fr/gwc02/service/wmts',
                        layer: 'satellite',
                        matrixSet: 'EPSG:3857',
                        format: 'image/png',
                        projection: projection,
                        tileGrid: new ol.tilegrid.WMTS({
                            origin: ol.extent.getTopLeft(projectionExtent),
                            resolutions: resolutions,
                            matrixIds: matrixIds
                        }),
                        extent: projectionExtent,
                        style: 'default'
                    })
                }),
                new ol.layer.Tile({
                    source: new ol.source.WMTS({
                        attributions: [new ol.Attribution({
                            html: 'carte <a href="https://geobretagne.fr/geonetwork/apps/georchestra/?uuid=3303a14b-44af-4950-b067-f43ddc0f483f">GéoBretagne</a>,' +
                                'données contributeurs <a href="http://www.openstreetmap.org/">OpenStreetMap</a> <a href="http://www.openstreetmap.org/copyright">ODbL</a>'
                        })],
                        url: 'http://osm.geobretagne.fr/gwc01/service/wmts',
                        layer: 'osm:roads',
                        matrixSet: 'EPSG:3857',
                        format: 'image/png',
                        projection: projection,
                        tileGrid: new ol.tilegrid.WMTS({
                            origin: ol.extent.getTopLeft(projectionExtent),
                            resolutions: resolutions,
                            matrixIds: matrixIds
                        }),
                        extent: projectionExtent,
                        style: 'default'
                    })
                })
            ]
        })
    ],

    /**
     * retrodata service
     */
    retrodata: {
        url: "https://geobretagne.fr/retrodata/",
        url_wfs: "https://geobretagne.fr/geoserver/geobretagne/wfs?",
        featuretype: "retrodata_sviewer",
        url_json: "https://geobretagne.fr/geoserver/geobretagne/wfs?service=wfs&version=2.0.0&request=getfeature&typename=retrodata_sviewer&outputformat=json",
        url_gcu: "http://cms.geobretagne.fr/content/carte-contributive-cgu",
    },

    /**
     * social media links (prefixes)
     */
    socialMedia: {
        'Twitter': 'https://twitter.com/intent/tweet?text=',
        'Google+': 'https://plus.google.com/share?url=',
        'Facebook': 'http://www.facebook.com/sharer/sharer.php?u='
    }
};
