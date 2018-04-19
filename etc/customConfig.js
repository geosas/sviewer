customConfig = {
    title: 'GeoSAS mobile',

    /**
     * force default language, see etc/i18n.js
     */
    // lang: 'fr',

    /**
     * base url of the geOrchetra SDI. Layers coming from this SDI
     * will have enhanced features.
     */
    geOrchestraBaseUrl: 'http://geowww.agrocampus-ouest.fr/',

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
    openLSGeocodeUrl: "http://gpp3-wxs.ign.fr/5sxxmfs1t5xnk2eexbq3in2q/geoportail/ols?",
//    openLSGeocodeUrl: "http://gpp3-wxs.ign.fr/[CLEF GEOPORTAIL]/geoportail/ols?",

    /**
     * background layers (EPSG:3857)
     */

    layersBackground: [

        // mapquest
/*
        new ol.layer.Tile({
            preload: 2,
            source: new ol.source.MapQuest({layer: 'osm'})
        }),
*/
        // OpenStreetMap
        new ol.layer.Tile({
            source: new ol.source.OSM()
        }),
        // IGN Ortho 
        new ol.layer.Tile({
            source: new ol.source.WMTS({
                attributions: [new ol.Attribution({ html: '<a href="http://www.geoportail.gouv.fr/">Géoportail</a>'
    +'&copy; <a href="http://www.ign.fr/">IGN-France</a>' })],
                url: "http://wxs.ign.fr/5sxxmfs1t5xnk2eexbq3in2q/wmts",
                layer: "ORTHOIMAGERY.ORTHOPHOTOS",
                matrixSet: "PM",
                projection: projection,
                style: "normal",
                tileGrid: new ol.tilegrid.WMTS({
                    origin: ol.extent.getTopLeft(projectionExtent),
                    resolutions: resolutions,
                    matrixIds: matrixIdsIGN
                }),
                format: 'image/jpeg',
                numZoomLevels: 20,
                group : "IGN"
            })
        }),
        // photo IGN & routes
        new ol.layer.Group({
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.WMTS({
                        attributions: [new ol.Attribution({ html: '<a href="http://www.geoportail.gouv.fr/">Géoportail</a>'
    +'&copy; <a href="http://www.ign.fr/">IGN-France</a>' })],
                        url: "http://wxs.ign.fr/5sxxmfs1t5xnk2eexbq3in2q/wmts",
                        layer: "ORTHOIMAGERY.ORTHOPHOTOS",
                        matrixSet: "PM",
                        projection: projection,
                        style: "normal",
                        tileGrid: new ol.tilegrid.WMTS({
                            origin: ol.extent.getTopLeft(projectionExtent),
                            resolutions: resolutions,
                            matrixIds: matrixIdsIGN
                        }),
                        format: 'image/jpeg',
                        numZoomLevels: 20,
                        group : "IGN"
                    })
                }),
                new ol.layer.Tile({
                    source: new ol.source.WMTS({
                        attributions: [new ol.Attribution({ html: ' / Carte <a href="http://geobretagne.fr/geonetwork/apps/georchestra/?uuid=3303a14b-44af-4950-b067-f43ddc0f483f">GéoBretagne</a>,'
                        + 'données contributeurs <a href="http://www.openstreetmap.org/">OpenStreetMap</a> <a href="http://www.openstreetmap.org/copyright">ODbL</a>' })],
//                        url: 'http://osm.geobretagne.fr/service/wmts',
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
        }),
        // Cartes IGN 
        new ol.layer.Tile({
            source: new ol.source.WMTS({
                attributions: [new ol.Attribution({ html: '<a href="http://www.geoportail.gouv.fr/">Géoportail</a>'
    +'&copy; <a href="http://www.ign.fr/">IGN-France</a>' })],
                url: "http://wxs.ign.fr/5sxxmfs1t5xnk2eexbq3in2q/wmts",
                layer: "GEOGRAPHICALGRIDSYSTEMS.MAPS",
                matrixSet: "PM",
                projection: projection,
                style: "normal",
                tileGrid: new ol.tilegrid.WMTS({
                    origin: ol.extent.getTopLeft(projectionExtent),
                    resolutions: resolutions,
                    matrixIds: matrixIdsIGN
                }),
                format: 'image/jpeg',
                numZoomLevels: 19,
                group : "IGN"
            })
        }),
        // MNT BDAlti V1 
        new ol.layer.Tile({
            source: new ol.source.WMTS({
                attributions: [new ol.Attribution({ html: '<a href="http://www.geoportail.gouv.fr/">Géoportail</a>'
    +'&copy; <a href="http://www.ign.fr/">IGN-France</a>' })],
//                url: "http://wxs.ign.fr/z8k3royft0ndj3dnjb491v6u/geoportail/wmts",
                url: "http://wxs.ign.fr/5sxxmfs1t5xnk2eexbq3in2q/wmts",
                layer: "ELEVATION.SLOPES",
                matrixSet: "PM",
                projection: projection,
                style: "normal",
                tileGrid: new ol.tilegrid.WMTS({
                    origin: ol.extent.getTopLeft(projectionExtent),
                    resolutions: resolutions,
                    matrixIds: matrixIdsIGN
                }),
                format: 'image/jpeg',
                numZoomLevels: 19,
                group : "IGN"
            })
        })
    ],

    /**
     * social media links (prefixes)
     */
    socialMedia: {
        'Twitter' : 'https://twitter.com/intent/tweet?text=',
        'Google+' : 'https://plus.google.com/share?url=',
        'Facebook': 'http://www.facebook.com/sharer/sharer.php?u='
    }
};
