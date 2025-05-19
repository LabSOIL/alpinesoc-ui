import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import './App.css';
import {
  MapContainer,
  Popup,
  Polygon,
  CircleMarker,
  Marker,
  Tooltip,
  useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import 'leaflet/dist/leaflet.css';
import TimeseriesPlot from './timeseries/TimeseriesPlot';
import { BaseLayers } from './maps/Layers';
import chroma from 'chroma-js';


const dataOptions = [
  { key: 'SOC', color: '#e41a1c' },
  { key: 'pH', color: '#377eb8' },
  { key: 'Temperature', color: '#4daf4a' },
  { key: 'Moisture', color: '#984ea3' },
];
const modelOptions = [
  { key: 'socStock', label: 'Output SOC stock' },
  { key: 'soilType', label: 'Input Soil type' },
  { key: 'vegetation', label: 'Input Vegetation' },
  { key: 'dem', label: 'Input DEM' },
  { key: 'curvature', label: 'Input Curvature' },
  { key: 'lithology', label: 'Input Lithology' },
  { key: 'aerialPhoto', label: 'Input Aerial photo' },
];

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

function Legend({ selectedData, areas, activeAreaId }) {
  const map = useMap();

  const getColorOnScale = (value, min, max) =>
    chroma.scale('viridis').domain([min, max])(value).hex();

  useEffect(() => {
    document.querySelectorAll('.info.legend').forEach(el => el.remove());
    if (!selectedData || !dataAccessors[selectedData]) return;

    let plots = activeAreaId
      ? areas.find(a => a.id === activeAreaId)?.plots || []
      : areas.flatMap(a => a.plots);

    const values = plots.map(dataAccessors[selectedData]).filter(v => typeof v === 'number');
    if (!values.length) return;

    const minVal = Math.floor(Math.min(...values));
    const maxVal = Math.ceil(Math.max(...values));
    const midVal = Math.round((minVal + maxVal) / 2);
    const start = getColorOnScale(minVal, minVal, maxVal);
    const end = getColorOnScale(maxVal, minVal, maxVal);

    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'info legend');
      div.innerHTML = `
        <h4>${selectedData}</h4>
        <div style="display:flex; align-items:center;">
          <div class="legend-scale"
               style="background: linear-gradient(to top, ${start}, ${end}); width:1rem; height:6rem; margin-right:0.5rem;"></div>
          <div class="legend-labels"
               style="display:flex; flex-direction:column; justify-content:space-between; height:6rem;">
            <span>${maxVal}</span>
            <span>${midVal}</span>
            <span>${minVal}</span>
          </div>
        </div>
      `;
      return div;
    };
    legend.addTo(map);

    return () => map.removeControl(legend);
  }, [map, selectedData, areas, activeAreaId]);

  return null;
}

export function CatchmentLayers({
  areas,
  activeAreaId,
  dataOption,
  onAreaClick,
  onSensorClick,
  recenterSignal,
  onRecenterHandled
}) {
  const map = useMap();
  const [hasZoomed, setHasZoomed] = useState(false);
  const defaultColor = '#3388ff';

  const { minVal, maxVal } = useMemo(() => {
    if (!dataOption) return { minVal: 0, maxVal: 1 };
    const accessor = dataAccessors[dataOption];
    let plots = activeAreaId
      ? areas.find(a => a.id === activeAreaId)?.plots || []
      : areas.flatMap(a => a.plots);
    const values = plots.map(accessor).filter(v => typeof v === 'number');
    return {
      minVal: values.length ? Math.floor(Math.min(...values)) : 0,
      maxVal: values.length ? Math.ceil(Math.max(...values)) : 1
    };
  }, [areas, activeAreaId, dataOption]);

  const getColor = value =>
    chroma.scale('viridis').domain([minVal, maxVal])(value).hex();

  useEffect(() => {
    if (!areas.length || !recenterSignal) return;
    setHasZoomed(false);
    const coords = (activeAreaId
      ? areas.find(a => a.id === activeAreaId)?.geom?.coordinates || []
      : areas.flatMap(a => a.geom?.coordinates || [])
    ).flatMap(ring => ring.map(([lng, lat]) => [lat, lng]));

    const doFly = () => {
      if (coords.length) {
        map.flyToBounds(L.latLngBounds(coords).pad(0.2), { duration: 1 });
        map.once('moveend', () => {
          setHasZoomed(true);
          onRecenterHandled();
        });
      } else {
        setHasZoomed(true);
        onRecenterHandled();
      }
    };
    if (map._loaded) doFly();
    else map.once('load', doFly);
  }, [areas, activeAreaId, map, recenterSignal, onRecenterHandled]);

  return (
    <>
      <BaseLayers />

      {areas.map(area => {
        if (!area.geom?.coordinates) return null;
        const positions = area.geom.coordinates.map(ring =>
          ring.map(([lng, lat]) => [lat, lng])
        );
        const isActive = area.id === activeAreaId;

        return (
          <React.Fragment key={area.id}>
            <Polygon
              positions={positions}
              pathOptions={{
                fillOpacity: isActive ? 0.5 : 0.25,
                color: isActive ? '#2b8cbe' : defaultColor
              }}
              eventHandlers={
                isActive && hasZoomed ? {} : { click: () => onAreaClick(area.id, true) }
              }
            >
              {!isActive && (
                <Tooltip
                  permanent
                  interactive
                  eventHandlers={{ click: () => onAreaClick(area.id, true) }}
                >
                  {area.name}
                </Tooltip>
              )}
            </Polygon>

            {isActive && hasZoomed && (dataOption === 'SOC' || dataOption === 'pH') &&
              area.plots.map(plot => {
                const coord = plot.geom?.['4326'];
                if (!coord) return null;
                const { x: lon, y: lat } = coord;
                const value = dataAccessors[dataOption](plot);
                const color = getColor(value);
                return (
                  <CircleMarker
                    key={plot.id}
                    center={[lat, lon]}
                    pathOptions={{ color, fillColor: color, fillOpacity: 1 }}
                    radius={Math.sqrt(plot.socStock)}
                  >
                    <Popup>
                      <strong>{plot.name}</strong><br />
                      Total depth: {plot.totalDepth} cm<br />
                      Samples: {plot.sampleCount}<br />
                      <hr />
                      Mean C: {plot.meanC.toFixed(2)} %<br />
                      SOC stock: {plot.socStock.toFixed(1)} Mg ha⁻¹
                    </Popup>
                  </CircleMarker>
                );
              })}

            {isActive && (dataOption === 'Temperature' || dataOption === 'Moisture') && area.sensors.map(sensor => {
              const coord = sensor.geom?.['4326'];
              if (!coord) return null;
              const { x: lon, y: lat } = coord;
              return (
                <Marker
                  key={sensor.id}
                  position={[lat, lon]}
                  zIndexOffset={1000}
                  eventHandlers={{
                    click: () => onSensorClick(sensor.id),
                  }}
                >
                  <Popup>
                    <strong>{sensor.name}</strong><br />
                    {dataOption}: {sensor[dataOption] ?? 'N/A'}
                  </Popup>
                </Marker>
              );
            })}

          </React.Fragment>
        );
      })}

      <Legend
        selectedData={dataOption}
        areas={areas}
        activeAreaId={activeAreaId}
      />
    </>
  );
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
  ]);
  const [areas, setAreas] = useState([]);
  const [sensorSeries, setSensorSeries] = useState(null);

  const [shouldRecenter, setShouldRecenter] = useState(false);
  const sectionsRef = useRef([]);

  const expBtnRef = useRef(null);
  const modBtnRef = useRef(null);
  const [thumbStyle, setThumbStyle] = useState({ left: 0, width: 0 });

  const handleSensorClick = async (sensorId) => {
    try {
      const res = await fetch(`/api/public/sensors/${sensorId}`);
      if (!res.ok) throw new Error('Failed to load sensor data');
      const json = await res.json();
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
              sampleCount: s.sample_count
            };
          })
        }));
        setAreas(enriched);
        setShouldRecenter(true);
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
    if (recenter) setShouldRecenter(true);
    setActiveAreaId(id);
    // selectedData handled by effect
  };

  const clearArea = () => {
    setActiveAreaId(null);
    setSelectedData(null);
    setShouldRecenter(true);
    scrollTo('catchment');
  };

  const selectData = key => setSelectedData(key);

  return (
    <div className="App">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
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
                <button
                  type="button"
                  className="menu-btn"
                  onClick={() => scrollTo(item.key)}
                >
                  {item.label}
                </button>

                {item.key === 'catchment' && (
                  <ul className="sub-menu">
                    {activeAreaId
                      ? <li className="active-area">
                        <span className="selected-area">
                          {areas.find(a => a.id === activeAreaId)?.name}
                          <button className="remove-selected" onClick={clearArea}>✕</button>
                        </span>
                      </li>
                      : item.subItems.map(s => (
                        <li key={s.key}>
                          <button className="submenu-btn" onClick={() => selectArea(s.key, true)}>
                            {s.label}
                          </button>
                        </li>
                      ))
                    }
                  </ul>
                )}

                {item.key === 'data' && activeAreaId && (
                  <>
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
              Soil organic carbon<br />
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
          <h2>{areas.find(a => a.id === activeAreaId)?.name || 'Catchment'}</h2>
          <div className="map-wrapper">

            {/* <div className="map-with-chart"> */}
            <MapContainer
              center={[46.326, 7.808]}
              zoom={10}
              scrollWheelZoom
              className="leaflet-container"
            >
              <CatchmentLayers
                areas={areas}
                activeAreaId={activeAreaId}
                dataOption={selectedData}
                onAreaClick={selectArea}
                onSensorClick={handleSensorClick}
                recenterSignal={shouldRecenter}
                onRecenterHandled={() => setShouldRecenter(false)}
              />
            </MapContainer>

            {sensorSeries && (selectedData === 'Temperature' || selectedData === 'Moisture') && (
              <div className="overlay-chart">
                <TimeseriesPlot series={sensorSeries} dataOption={selectedData} />
              </div>
            )}
          </div>
          {/* </div> */}
        </section>
      </main>
    </div>
  );
}
