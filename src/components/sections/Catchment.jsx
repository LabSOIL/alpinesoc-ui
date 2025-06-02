import {
  MapContainer,
  Pane,
  GeoJSON,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import TimeseriesPlot from '../timeseries/TimeseriesPlot';
import IdentifyControl from '../maps/IdentifyControl';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css'
import { getStaticModelUrl } from '../maps/fileHelpers'
import { CatchmentLayers } from '../maps/Catchment';
import { ModelRaster } from '../maps/Layers';
import React from 'react';


function ModelLayer({ areaName, dataOption, soilTypeMappings, vegetationMappings, defaultColour }) {
    function soilStyle(feature) {
        const raw = feature.properties.name || '';
        const key = raw.replace(/[-\s]/g, '');  
        const mapping = soilTypeMappings[key] || { name: raw, color: '#000' };
        return {
          color:      mapping.color,
          fillColor:  mapping.color,
          weight:     2,
          fillOpacity: 0.75,
        };
      }
      
    function vegetationStyle(feature) {
      const raw = feature.properties.name;
      const mapping = vegetationMappings[raw] || { name: raw, color: defaultColour };
      return {
        color: mapping.color,
        fillColor: mapping.color,
        weight: 2,
        fillOpacity: 0.75,
      };
    }
    
    const url = getStaticModelUrl(areaName, dataOption);
  if (!url) return null;
  const key = url;

  // raster outputs
  if (dataOption === 'ndvi' || dataOption === 'socStock') {
    return (
      <ModelRaster
        key={key}
        url={url}
        dataOption={dataOption}
      />
    );
  }
  
  const onEachFeatureFn = (feature, layer) => {
    if (dataOption === 'vegetation') {
      const code    = feature.properties.name;
      const label   = vegetationMappings[code]?.name || code;
      layer.bindPopup(label);
    }
    else if (dataOption === 'soilType') {
      const raw     = feature.properties.name;
      const key     = raw.replace(/[-\s]/g, '');
      const mapping = soilTypeMappings[key] || { name: raw };
      layer.bindPopup(mapping.name);
    }
    else {
      layer.bindPopup(feature.properties.name || areaName);
    }
  };
  return (
    <VectorGeoJSON
      url={url}
      style={dataOption === 'soilType' ? soilStyle : vegetationStyle}
      onEachFeature={onEachFeatureFn}
    />
  );
}

function VectorGeoJSON({ url, style, onEachFeature }) {
  const [data, setData] = React.useState(null)
  React.useEffect(() => {
    fetch(url)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
  }, [url])
  if (!data) return null
  return <GeoJSON data={data} style={style} onEachFeature={onEachFeature} />
}

    
export default function Catchment({
  areas,
  activeAreaId,
  selectedData,
  viewMode,
  selectArea,
  handleSensorClick,
  sensorSeries,
  setSensorSeries,
  setShouldRecenter,
  shouldRecenter,
  sectionsRef,
  bounds,
  centroid,
  soilTypeMappings,
  vegetationMappings,
  defaultColour,

}) {
    const area = areas.find(a => a.id === activeAreaId)
    const areaName = area?.name
    return (
    <>
       <section
          className="section"
          data-section="catchment"
          ref={el => sectionsRef.current[1] = el}
        >
          <h2>{areas.find(a => a.id === activeAreaId)?.name || 'Select a catchment'}</h2>
          <div className="map-wrapper">
            <MapContainer
              center={centroid}
              zoom={9}
              minZoom={8}
              scrollWheelZoom
              className="leaflet-container"
              maxBounds={bounds} // Set max bounds
              maxBoundsViscosity={1.0} // Prevent panning outside bounds
            >
              <Pane name="rasterPane" style={{ zIndex: 450 }} />
              <CatchmentLayers
                areas={areas}
                activeAreaId={activeAreaId}
                dataOption={selectedData}
                onAreaClick={selectArea}
                onSensorClick={handleSensorClick}
                onSensorClose={() => setSensorSeries(null)}
                recenterSignal={shouldRecenter}
                onRecenterHandled={() => setShouldRecenter(false)}
                bounds={bounds}
                centroid={centroid}
                soilTypeMappings={soilTypeMappings}
                vegetationMappings={vegetationMappings}
                defaultColour={defaultColour}
              />
              <IdentifyControl />

              {viewMode === 'model' && activeAreaId && (
                <ModelLayer
                  key={getStaticModelUrl(areaName, selectedData)}
                  areaName={areaName}
                  dataOption={selectedData}
                  soilTypeMappings={soilTypeMappings}
                  vegetationMappings={vegetationMappings}
                  defaultColour={defaultColour}
                />
              )}
            </MapContainer>
            {sensorSeries && (selectedData === 'Temperature' || selectedData === 'Moisture') && (
              <div className="overlay-chart">
                <TimeseriesPlot series={sensorSeries} dataOption={selectedData} />
              </div>
            )}
          </div>
        </section>
        </>
    );
}
