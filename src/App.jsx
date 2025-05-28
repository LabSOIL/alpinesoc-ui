import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import './App.css';
import {
  MapContainer,
  Popup,
  Polygon,
  CircleMarker,
  GeoJSON,
  Tooltip,
  useMap,
  Pane,
} from 'react-leaflet';
import L from 'leaflet';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import 'leaflet/dist/leaflet.css';
import TimeseriesPlot from './timeseries/TimeseriesPlot';
import { BaseLayers, GeoTiffLayer, ModelRaster } from './maps/Layers';
import chroma from 'chroma-js';
import IdentifyControl from './maps/IdentifyControl';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css'
import { getStaticModelUrl } from './maps/fileHelpers'

const dataOptions = [
  { key: 'SOC', color: '#e41a1c' },
  { key: 'pH', color: '#377eb8' },
  { key: 'Temperature', color: '#4daf4a' },
  { key: 'Moisture', color: '#984ea3' },
];
const modelOptions = [
  { key: 'ndvi', label: 'NDVI' },
  { key: 'socStock', label: 'Output SOC stock' },
  { key: 'soilType', label: 'Input Soil type' },
  { key: 'vegetation', label: 'Input Vegetation' },
];

const swissBounds = [[45.5, 5.5], [48.0, 11.0]];
const valaisBounds = [[45.8, 6.0], [47.3, 8.5]];
const defaultColor = '#000000';
const soilTypeMappings = {
  Colluviosol:  { name: 'Colluviosol',      color: '#8c510a' },
  Podzosol:     { name: 'Podzosol',         color: '#b35806' },
  Rankosol:     { name: 'Rankosol',         color: '#d8b365' },
  Epihistosol:  { name: 'Epihistosol',      color: '#f6e8C3' },
  Histosol:     { name: 'Histosol',         color: '#d1e5f0' },
  HistoFluviosol: { name: 'Histo-Fluviosol', color: '#67a9cf' },
  Fluviosol:    { name: 'Fluviosol',        color: '#2166ac' },
};

const vegetationMappings = {
  RV: { name: 'Rhododendron-Vaccinion', color: '#4d9221' },
  Na: { name: 'Nardion', color: '#a1d76a' },
  Cal: { name: 'Calthion', color: '#d9f0d3' },
  Cro: { name: 'Caricetum rostratae', color: '#C7eae5' },
  Cd: { name: 'Caricion davallianae', color: '#5ab4ac' },
  Cfu: { name: 'Caricion fuscae', color: '#01665e' },
};

const dataAccessors = {
  SOC: plot => plot.socStock,
  pH: plot => plot.pH,
  Temperature: plot => plot.temperature,
  Moisture: plot => plot.soilMoisture,
  socStock: plot => plot.socStock,
  soilType: plot => plot.soilType,
  vegetation: plot => plot.vegetation,
  dem: plot => plot.dem,
  curvature: plot => plot.curvature,
  lithology: plot => plot.lithology,
  aerialPhoto: plot => plot.aerialPhoto,
};

export function soilStyle(feature) {
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
  const mapping = vegetationMappings[raw] || { name: raw, color: defaultColor };
  return {
    color: mapping.color,
    fillColor: mapping.color,
    weight: 2,
    fillOpacity: 0.75,
  };
}


function ModelLayer({ areaName, dataOption }) {
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

  // vector outputs: soilType vs. vegetation
  const styleFn =
    dataOption === 'soilType'
      ? soilStyle
      : dataOption === 'vegetation'
        ? vegetationStyle
        : soilStyle; // fallback
  
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

export function Legend({ dataOption, title, colorScale, minVal, maxVal }) {
  const map = useMap();

  useEffect(() => {
    document.querySelectorAll('.info.legend').forEach(el => el.remove());
    if (!dataOption) return;

    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = () => {
      const container = L.DomUtil.create('div', 'info legend');
      Object.assign(container.style, {
        display: 'block',
        textAlign: 'left',
        padding: '0.5em',
        maxHeight: '12rem',
        overflowY: 'auto',
        font: '14px/16px Arial, Helvetica, sans-serif',
        background: 'rgba(255,255,255,0.9)',
        color: '#333',
        borderRadius: '5px',
        boxShadow: '0 0 15px rgba(0,0,0,0.2)',
      });

      // DISCRETE LEGEND
      if (dataOption === 'soilType' || dataOption === 'vegetation') {
        const items = dataOption === 'vegetation'
          ? vegetationMappings
          : soilTypeMappings;

        container.innerHTML = `<h4 style="margin:0 0 .5em; padding:0">${title}</h4>`;

        Object.entries(items).forEach(([code, { name, color }]) => {
          container.innerHTML += `
            <div style="
              display:flex;
              align-items:center;
              margin:0.25em 0;
              padding:0;
            ">
              <span style="
                display:inline-block;
                width:1rem;
                height:1rem;
                background:${color};
                margin-right:0.5rem;
                border:1px solid #555;
              "></span>
              <span style="margin:0; padding:0;">${name}</span>
            </div>
          `;
        });

      // CONTINUOUS SCALE LEGEND
      } else {
        const midVal = Math.round((minVal + maxVal) / 2);
        const STEPS = 10;
        const samples = colorScale.colors(STEPS);
        const stops = samples
          .map((c, i) => `${c} ${Math.round((i / (STEPS - 1)) * 100)}%`)
          .join(', ');

        container.innerHTML = `
          <h4 style="margin:0 0 .5em; padding:0; white-space:normal">
            ${title}
          </h4>
          <div style="display:flex; align-items:center">
            <div style="
              background: linear-gradient(to top, ${stops});
              width:1rem;
              height:6rem;
              margin-right:0.5rem;
            "></div>
            <div style="
              display:flex;
              flex-direction:column;
              justify-content:space-between;
              height:6rem;
              text-align:left;
            ">
              <span>${maxVal}</span>
              <span>${midVal === minVal || midVal === maxVal ? '' : midVal}</span>
              <span>${minVal}</span>
            </div>
          </div>
        `;
      }

      return container;
    };

    legend.addTo(map);
    return () => map.removeControl(legend);
  }, [map, dataOption, title, colorScale, minVal, maxVal]);

  return null;
}


export function CatchmentLayers({
  areas,
  activeAreaId,
  dataOption,
  viewMode,
  onAreaClick,
  onSensorClick,
  onSensorClose,
  recenterSignal,
  onRecenterHandled
}) {
  const map = useMap()
  const [hasZoomed, setHasZoomed] = useState(false)

  // common: fly to bounds when area changes
  useEffect(() => {
    if (!areas.length || !recenterSignal) return
    setHasZoomed(false)

    const coords = activeAreaId
      ? areas.find(a => a.id === activeAreaId)?.geom.coordinates.flatMap(
        ring => ring.map(([lng, lat]) => [lat, lng])
      )
      : valaisBounds


    const doFly = () => {
      map.flyToBounds(L.latLngBounds(coords).pad(0.2), { duration: 1 })
      map.once('moveend', () => {
        setHasZoomed(true)
        onRecenterHandled()
      })
    }
    map._loaded ? doFly() : map.once('load', doFly)
  }, [areas, activeAreaId, recenterSignal])

  const { minVal, maxVal } = useMemo(() => {
    // for Temperature/Moisture, read the sensors’ 30 cm bucket
    if (dataOption === 'Temperature' || dataOption === 'Moisture') {
      const sensorVals = (activeAreaId
        ? areas.find(a => a.id === activeAreaId)?.sensors || []
        : areas.flatMap(a => a.sensors)
      )
        .map(s => {
          const depths =
            dataOption === 'Temperature'
              ? s.average_temperature || {}
              : s.average_moisture || {};
          const v30 = depths['30'];
          return typeof v30 === 'number' ? v30 : null;
        })
        .filter(v => v != null);

      if (sensorVals.length) {
        return {
          minVal: Math.floor(Math.min(...sensorVals)),
          maxVal: Math.ceil(Math.max(...sensorVals)),
        };
      }
      return { minVal: 0, maxVal: 1 };
    }

    // otherwise fall back to your original plot‐based logic (guarded!)
    const accessor = dataAccessors[dataOption];
    if (typeof accessor !== 'function') {
      return { minVal: 0, maxVal: 1 };
    }
    const plots = activeAreaId
      ? areas.find(a => a.id === activeAreaId)?.plots || []
      : areas.flatMap(a => a.plots);
    const vals = plots.map(accessor).filter(v => typeof v === 'number');
    return {
      minVal: vals.length ? Math.floor(Math.min(...vals)) : 0,
      maxVal: vals.length ? Math.ceil(Math.max(...vals)) : 1,
    };
  }, [areas, activeAreaId, dataOption]);
  
  const legendTitles = {
    SOC: 'SOC<br/>[MgC/ha]',
    pH: 'pH',
    Temperature: 'Avg. temperature (30cm)<br/>[°C]',
    Moisture: 'Moisture (30cm)<br/>[raw counts]',
    ndvi: 'NDVI',
    socStock: 'Output SOC stock<br/>[MgC/ha]',
    soilType: 'Input Soil type',
    vegetation: 'Input Vegetation',
  };

  // green color ramp for everything
  const colorScale = useMemo(() => {
    // use true Viridis only for SOC stock
    if (dataOption === 'socStock') {
      return chroma.scale('viridis').domain([minVal, maxVal]);
    }
    // otherwise keep your green ramp
    return chroma
      .scale(['#ffffcc', '#c2e699', '#31a354', '#006837'])
      .domain([minVal, maxVal]);
  }, [dataOption, minVal, maxVal]);
  const getColor = v => colorScale(v).hex()

  return (
    <>
      <BaseLayers />

      {areas.map(area => {
        if (!area.geom?.coordinates) return null
        const positions = area.geom.coordinates.map(
          ring => ring.map(([lng, lat]) => [lat, lng])
        )
        const isActive = area.id === activeAreaId

        return (
          <React.Fragment key={area.id}>
            <Polygon
              positions={positions}
              pathOptions={{
                fillOpacity: 0.25,
                color: isActive ? '#2b8cbe' : defaultColor
              }}
              eventHandlers={{
                add: e => e.target.bringToBack(),
                click: () => !isActive && onAreaClick(area.id, true)
              }}
            >
              {!isActive && (
                <Tooltip permanent interactive
                  eventHandlers={{ click: () => onAreaClick(area.id, true) }}
                >
                  {area.name}
                </Tooltip>
              )}
            </Polygon>

            {isActive && hasZoomed && ['SOC', 'pH'].includes(dataOption) &&
              area.plots.map(plot => {
                const c = plot.geom['4326']; if (!c) return null
                const { x: lon, y: lat } = c
                const val = dataAccessors[dataOption](plot)
                const clr = getColor(val)
                const rad = dataOption === 'SOC'
                  ? Math.sqrt(plot.socStock) : 6

                return (
                  <CircleMarker
                    key={plot.id}
                    center={[lat, lon]}
                    pathOptions={{ color: clr, fillColor: clr, fillOpacity: 1 }}
                    radius={rad}
                  >
                    <Popup>
                      <strong>{plot.name}</strong><br />
                      {dataOption === 'SOC'
                        ? <>
                          <strong>Total depth</strong>: {plot.totalDepth} cm<br />
                          <strong>SOC stock</strong>: {plot.socStock.toFixed(1)} Mg ha⁻¹
                        </>
                        : <><strong>pH</strong>: {plot.pH.toFixed(2)}</>
                      }
                    </Popup>
                  </CircleMarker>
                )
              })
            }

            {isActive && hasZoomed && ['Temperature', 'Moisture'].includes(dataOption) &&
              area.sensors.map(sensor => {
                const c = sensor.geom['4326']; if (!c) return null
                const { x: lon, y: lat } = c
                const avg = dataOption === 'Temperature'
                  ? sensor.average_temperature : sensor.average_moisture
                const v30 = avg?.['30'] ?? null
                const clr = v30 != null ? getColor(v30) : defaultColor

                return (
                  <CircleMarker
                    key={sensor.id}
                    center={[lat, lon]}
                    pathOptions={{ color: clr, fillColor: clr, fillOpacity: 1 }}
                    radius={8}
                    eventHandlers={{ click: () => onSensorClick(sensor.id) }}
                  >
                    <Popup eventHandlers={{ remove: () => onSensorClose() }}>
                      <strong>{sensor.name}</strong><br /><br />
                      {Object.entries(avg || {}).map(([d, v]) => (
                        <div key={d}>
                          <strong>{d} cm</strong>: {v.toFixed(2)}
                          {dataOption === 'Temperature' ? ' °C' : ' [raw]'}
                        </div>
                      ))}
                    </Popup>
                  </CircleMarker>
                )
              })
            }

            <Legend
              dataOption={dataOption}
              title={legendTitles[dataOption] || dataOption}
              colorScale={colorScale}
              minVal={minVal}
              maxVal={maxVal}
            />
          </React.Fragment>
        )
      })}
    </>
  )
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('cover');
  const [activeAreaId, setActiveAreaId] = useState(null);
  const [selectedData, setSelectedData] = useState(null);
  const [viewMode, setViewMode] = useState('experimental'); // 'experimental' or 'model'
  const [menuItems, setMenuItems] = useState([
    { key: 'cover', label: 'Home' },
    { key: 'catchment', label: 'Catchment', subItems: [] },
    { key: 'data', label: 'Data', subItems: [] },
    { key: 'about', label: 'About' },
  ]);
  const [areas, setAreas] = useState([]);
  const [sensorSeries, setSensorSeries] = useState(null);
  const sensorCacheRef = useRef({});


  const [shouldRecenter, setShouldRecenter] = useState(false);
  const sectionsRef = useRef([]);

  const expBtnRef = useRef(null);
  const modBtnRef = useRef(null);
  const [thumbStyle, setThumbStyle] = useState({ left: 0, width: 0 });
  const area = areas.find(a => a.id === activeAreaId)
  const areaName = area?.name

  const handleSensorClick = async (sensorId) => {
    // build a cache key so temp and moisture are stored separately
    const cacheKey = `${sensorId}_${selectedData}`;
    const cached = sensorCacheRef.current[cacheKey];
    if (cached) {
      setSensorSeries(cached);
      return;
    }

    // pick the right endpoint
    let endpoint;
    if (selectedData === 'Temperature') {
      endpoint = `/api/public/sensors/${sensorId}/temperature`;
    } else if (selectedData === 'Moisture') {
      endpoint = `/api/public/sensors/${sensorId}/moisture`;
    }

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Failed to load sensor data (${res.status})`);
      const json = await res.json();

      // cache it by sensorId + data type
      sensorCacheRef.current[cacheKey] = json;
      setSensorSeries(json);
    } catch (err) {
      console.error(err);
    }
  };



  useLayoutEffect(() => {
    const updateThumb = () => {
      const ref = viewMode === 'experimental' ? expBtnRef : modBtnRef;
      if (ref.current) {
        const { offsetLeft, offsetWidth } = ref.current;
        setThumbStyle({ left: offsetLeft, width: offsetWidth });
      }
    };
    updateThumb();
    window.addEventListener('resize', updateThumb);
    return () => window.removeEventListener('resize', updateThumb);
  }, [viewMode, activeAreaId]); // ← add activeAreaId here





  const scrollTo = key => {
    const idx = menuItems.findIndex(i => i.key === key);
    sectionsRef.current[idx]?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetch('/api/public/areas')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const enriched = data.map(area => ({
          ...area,
          plots: area.plots.map(plot => {
            const s = plot.aggregated_samples['1'];
            return {
              ...plot,
              socStock: s.soc_stock_megag_per_hectare,
              meanC: s.mean_c,
              totalDepth: s.total_depth,
              temperature: s.temperature,
              soilMoisture: s.soil_moisture,
              sampleCount: s.sample_count,
              pH: s.ph
            };
          })
        }));
        setAreas(enriched);
      })
      .catch(console.error);
  }, []);

  // build catchment submenu when areas fetched or section changes
  useEffect(() => {
    if (activeSection === 'catchment' && areas.length) {
      const subs = areas.map(a => ({ key: a.id, label: a.name }));
      setMenuItems(m =>
        m.map(i => i.key === 'catchment' ? { ...i, subItems: subs } : i)
      );
    }
  }, [activeSection, areas]);

  // build data submenu on area or mode change
  useEffect(() => {
    setMenuItems(m =>
      m.map(i =>
        i.key === 'data'
          ? {
            ...i,
            subItems: activeAreaId
              ? viewMode === 'experimental'
                ? dataOptions.map(o => ({ key: o.key, label: o.key }))
                : modelOptions
              : []
          }
          : i
      )
    );
  }, [activeAreaId, viewMode]);

  // reset selectedData when mode or area changes
  useEffect(() => {
    if (!activeAreaId) return;
    const firstKey = viewMode === 'experimental'
      ? dataOptions[0].key
      : modelOptions[0].key;
    setSelectedData(firstKey);
  }, [viewMode, activeAreaId]);

  useEffect(() => {
    const io = new IntersectionObserver(es => {
      es.forEach(e => e.isIntersecting && setActiveSection(e.target.dataset.section));
    }, { threshold: 0.6 });
    sectionsRef.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (activeSection !== 'cover') setSidebarOpen(true);
  }, [activeSection]);

  const selectArea = (id, recenter = false) => {
    setSensorSeries(null);
    if (recenter) setShouldRecenter(true);
    setActiveAreaId(id);
  };

  const clearArea = () => {
    setSensorSeries(null);
    setActiveAreaId(null);
    setSelectedData(null);
    setShouldRecenter(true);
    scrollTo('catchment');
  };

  const selectData = key => {
    setSensorSeries(null);
    setSelectedData(key);
  };

  return (
    <div className="App">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
      <div
        className="grabber"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      />
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen
            ? <ChevronLeftIcon fontSize="large" />
            : <ChevronRightIcon fontSize="large" />}
        </button>
        <nav>
          <ul>
            {menuItems.map(item => (
              <li key={item.key} className={activeSection === item.key ? 'active' : ''}>
                {item.key !== 'data' && (
                  <button
                    type="button"
                    className="menu-btn"
                    onClick={() => {
                      if (item.key === 'catchment' || item.key === 'about') clearArea();
                      scrollTo(item.key);
                    }}
                  >
                    {activeSection === item.key ? <strong>{item.label}</strong> : item.label}
                  </button>
                )}

                {item.key === 'catchment' && activeSection === 'catchment' && (
                  <ul className="sub-menu">
                    {item.subItems.map(s => (
                      <li key={s.key} className={activeAreaId === s.key ? 'active-area' : ''}>
                        <button
                          className={`submenu-btn ${activeAreaId === s.key ? 'active-data' : ''}`}
                          onClick={() => selectArea(s.key, true)}
                        >
                          {s.label}
                        </button>
                        {activeAreaId === s.key && (
                          <button className="remove-selected" onClick={clearArea}>✕</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {item.key === 'data' && activeAreaId && (
                  <>
                    <hr style={{ width: '90%', margin: '1rem auto', marginLeft: '0', display: 'block' }} />
                    <div className="mode-switch">

                      <div
                        className="mode-switch-thumb"
                        style={{ left: thumbStyle.left, width: thumbStyle.width }}
                      />

                      <button
                        ref={expBtnRef}
                        className={`mode-btn ${viewMode === 'experimental' ? 'active' : ''}`}
                        onClick={() => setViewMode('experimental')}
                      >
                        Experimental
                      </button>
                      <button
                        ref={modBtnRef}
                        className={`mode-btn ${viewMode === 'model' ? 'active' : ''}`}
                        onClick={() => setViewMode('model')}
                      >
                        Model
                      </button>
                    </div>

                    <ul className="sub-menu">
                      {item.subItems.map(s => (
                        <li key={s.key}>
                          <button
                            className={`submenu-btn ${selectedData === s.key ? 'active-data' : ''}`}
                            onClick={() => selectData(s.key)}
                          >
                            {s.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <hr style={{ width: '90%', margin: '1rem auto', marginLeft: '0', display: 'block' }} />

                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="sections">
        {/* COVER */}
        <section
          className="section cover"
          data-section="cover"
          ref={el => sectionsRef.current[0] = el}
        >
          <div className="cover-content">
            <h1>
              Soil organic carbon
              in Swiss alpine environments
            </h1>
          </div>
          <button
            className="down-arrow"
            onClick={() => scrollTo('catchment')}
            aria-label="Scroll down"
          >
            ↓
          </button>
          <div className="attribution">
            <a href="https://www.epfl.ch" target="_blank" rel="noopener noreferrer">
              <img src="/epfl.png" alt="EPFL Logo" style={{ height: '2rem', marginRight: '1rem' }} />
            </a>
            <a href="https://www.snf.ch" target="_blank" rel="noopener noreferrer">
              <img src="/snsf.svg" alt="SNSF Logo" style={{ height: '2rem' }} />
            </a>
          </div>
        </section>

        {/* CATCHMENT */}
        <section
          className="section"
          data-section="catchment"
          ref={el => sectionsRef.current[1] = el}
        >
          <h2>{areas.find(a => a.id === activeAreaId)?.name || 'Select a catchment'}</h2>
          <div className="map-wrapper">
            <MapContainer
              bounds={valaisBounds}
              zoom={8}
              minZoom={8}
              scrollWheelZoom
              className="leaflet-container"
              maxBounds={swissBounds} // Set max bounds
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
              />
              <IdentifyControl />

              {viewMode === 'model' && activeAreaId && (
                <ModelLayer
                  key={getStaticModelUrl(areaName, selectedData)}
                  areaName={areaName}
                  dataOption={selectedData}
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

        {/* ABOUT */}
        <section
          className="section about-section"
          data-section="about"
          ref={el => sectionsRef.current[3] = el}
        >
          <div className="about-card distinct-about-card">
            <h2>About This Platform</h2>
            <div className="about-body">
              <p style={{ textIndent: "2em", marginBottom: "1.5em" }}>
                This platform provides access to measurements and model outputs of soil organic carbon (SOC), pH, temperature, and moisture across Swiss alpine catchments.
              </p>

              <h4>Attribution</h4>
              <ul style={{ marginLeft: "2em", marginBottom: "1em" }}>
                <li>
                  <a href="https://www.epfl.ch/labs/soil/" target="_blank" rel="noopener noreferrer">
                  Soil Biogeochemistry Laboratory
                  </a>
                </li>
                <li>
                  <a href="https://www.epfl.ch" target="_blank" rel="noopener noreferrer">
                    EPFL – École polytechnique fédérale de Lausanne
                  </a>
                </li>
                <li>
                  <a href="https://www.snf.ch" target="_blank" rel="noopener noreferrer">
                    SNSF – Swiss National Science Foundation
                  </a>
                </li>
                <li>
                  Platform development:
                  <a href="https://github.com/evanjt" target="_blank" rel="noopener noreferrer">Evan Thomas</a>
                </li>
              </ul>
            </div>
          </div>
        </section>



      </main>
    </div >
  );
}
