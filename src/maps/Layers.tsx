import { LayersControl, TileLayer } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import parseGeoraster from 'georaster'
import GeoRasterLayer from 'georaster-layer-for-leaflet'
import chroma from 'chroma-js';

export const BaseLayers = () => {
    const { BaseLayer, Overlay } = LayersControl;
    return (
        <LayersControl collapsed={false}>
            <BaseLayer checked name="SwissTopo">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">SwissTopo</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
                    opacity={0.5}
                />
            </BaseLayer>
            <BaseLayer name="SwissTopo Aerial">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">SwissTopo</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg"
                    opacity={0.5}
                />
            </BaseLayer>
            <BaseLayer name="SwissTopo swissALTI3D">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">SwissTopo swissALTI3D</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
                    opacity={0.5}
                />
            </BaseLayer>
            <BaseLayer name="SwissTopo Lithology GeoCover">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">SwissTopo GeoCover</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.geologie-geocover/default/current/3857/{z}/{x}/{y}.png"
                    opacity={0.5}
                    maxNativeZoom={16} // Specifies the maximum zoom level with available tiles
                />
            </BaseLayer>
            <BaseLayer name="OpenStreetMap">
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    opacity={0.5}
                />
            </BaseLayer>
        </LayersControl >)
};


export function GeoTiffLayer({ url, opacity = 0.7, resolution = 128 }) {
    const map = useMap();
    const layerRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        async function addLayer() {
            try {
                const buffer = await fetch(url).then(r => r.arrayBuffer());
                const gr = await parseGeoraster(buffer);
                if (cancelled) return;

                const [min, max] = [gr.mins[0], gr.maxs[0]];
                const scale = chroma
                    .scale(['#ffffcc', '#c2e699', '#31a354', '#006837'])
                    .domain([min, max]);

                layerRef.current = new GeoRasterLayer({
                    georaster: gr,
                    opacity,
                    resolution,
                    pixelValuesToColorFn: px =>
                        px[0] == null ? null : scale(px[0]).hex(),
                });

                map.addLayer(layerRef.current);
            } catch (e) {
                console.error(e);
            }
        }

        // start loading the new layer
        addLayer();

        // cleanup: cancel pending work & remove any existing layer
        return () => {
            cancelled = true;
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [map, url, opacity, resolution]);

    return null;
}
