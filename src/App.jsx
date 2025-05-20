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
function Legend({ selectedData, colorScale, minVal, maxVal }) {
  const map = useMap();

  useEffect(() => {
    document.querySelectorAll('.info.legend').forEach(el => el.remove());
    if (!selectedData) return;

    const midVal = Math.round((minVal + maxVal) / 2);
    // Disable the midval if it's the same as min or max
    const midValText = midVal === minVal || midVal === maxVal ? undefined : midVal;
    
  
    // sample the viridis scale at 10 steps
    const STEPS = 10;
    const samples = colorScale.colors(STEPS);
    const gradientStops = samples
      .map((c, i) => {
        const pct = Math.round((i / (STEPS - 1)) * 100);
        return `${c} ${pct}%`;
      })
      .join(', ');
    if (selectedData === 'Temperature' ) {
      selectedData = 'Average temperature<br/>(20 cm)';
    }
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'info legend');
      div.innerHTML = `
        <h4 style="margin-top: 0;">${selectedData}</h4>
        <div style="display:flex; align-items:center;">
          <div class="legend-scale"
           style="
             background: linear-gradient(to top, ${gradientStops});
             width:1rem; height:6rem; margin-right:0.5rem;
           ">
          </div>
          <div class="legend-labels"
           style="
             display:flex; flex-direction:column;
             justify-content:space-between; height:6rem;
           ">
        <span>${maxVal}</span>
        <span>${midValText !== undefined ? midValText : ''}</span>
        <span>${minVal}</span>
          </div>
        </div>
      `;
      return div;
    };
    legend.addTo(map);

    return () => map.removeControl(legend);
  }, [map, selectedData, colorScale, minVal, maxVal]);

  return null;
}


export function CatchmentLayers({
  areas,
  activeAreaId,
  dataOption,
  onAreaClick,
  onSensorClick,
  onSensorClose,           
  recenterSignal,
  onRecenterHandled
}) {
  const map = useMap();
  const [hasZoomed, setHasZoomed] = useState(false);
  const defaultColor = '#3388ff';

  const { minVal, maxVal } = useMemo(() => {
    // for Temperature/Moisture, read the sensors’ 20 cm bucket
    if (dataOption === 'Temperature' || dataOption === 'Moisture') {
      const sensorVals = (activeAreaId
        ? areas.find(a => a.id === activeAreaId)?.sensors || []
        : areas.flatMap(a => a.sensors)
      )
        .map(s => {
          const depths =
            dataOption === 'Temperature'
              ? s.average_temperature || {}
              : s.average_moisture    || {};
          const v20 = depths['20'];
          return typeof v20 === 'number' ? v20 : null;
        })
        .filter(v => v != null);

      if (sensorVals.length) {
        return {
          minVal: Math.floor(Math.min(...sensorVals)),
          maxVal: Math.ceil (Math.max(...sensorVals)),
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
      maxVal: vals.length ? Math.ceil (Math.max(...vals)) : 1,
    };
  }, [areas, activeAreaId, dataOption]);

  const colorScale = useMemo(
    () => chroma.scale('viridis').domain([minVal, maxVal]),
    [minVal, maxVal]
  );
  const getColor = value => colorScale(value).hex();
  
  // Derive a nicer legend title
  const legendTitle = (() => {
    if (dataOption === 'Temperature') return 'Average temperature (20 cm)';
    if (dataOption === 'Moisture')    return 'Average moisture (20 cm)';
    return dataOption;
  })();
  
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
                const coord = plot.geom?.['4326']
                if (!coord) return null
                const { x: lon, y: lat } = coord

                // value is either socStock or pH depending on dataOption
                const value = dataAccessors[dataOption](plot)
                const color = getColor(value)

                // radius: sqrt(socStock) for SOC, fixed for pH (you can tweak 6 to taste)
                const radius = dataOption === 'SOC'
                  ? Math.sqrt(plot.socStock)
                  : 6

                return (
                  <CircleMarker
                    key={plot.id}
                    center={[lat, lon]}
                    pathOptions={{ color, fillColor: color, fillOpacity: 1 }}
                    radius={radius}
                  >
                    <Popup>
                      <strong>{plot.name}</strong><br />

                      {dataOption === 'SOC' ? (
                        <>
                          Total depth: {plot.totalDepth} cm<br />
                          Samples: {plot.sampleCount}<br />
                          <hr />
                          Mean C: {plot.meanC.toFixed(2)} %<br />
                          SOC stock: {plot.socStock.toFixed(1)} Mg ha⁻¹
                        </>
                      ) : (
                        <>
                          pH: {plot.pH.toFixed(2)}<br />
                        </>
                      )}
                    </Popup>
                  </CircleMarker>
                )
              })}


{isActive && (dataOption === 'Temperature' || dataOption === 'Moisture') &&
              area.sensors.map(sensor => {
                const coord = sensor.geom?.['4326'];
                if (!coord) return null;
                const { x: lon, y: lat } = coord;
                const avgByDepth = dataOption === 'Temperature'
                  ? sensor.average_temperature
                  : sensor.average_moisture;
                const val20 = avgByDepth?.['20'] ?? null;
                const color = val20 !== null
                  ? getColor(val20)
                  : defaultColor;

                return (
                  <CircleMarker
                    key={sensor.id}
                    center={[lat, lon]}
                    pathOptions={{ color, fillColor: color, fillOpacity: 1 }}
                    radius={8}
                    eventHandlers={{ click: () => onSensorClick(sensor.id) }}
                  >
                    <Popup
                      eventHandlers={{
                        remove: () => onSensorClose()
                      }}
                    >
                      <strong>{sensor.name}</strong><br/><br/>
                      <div><strong>Average {dataOption}</strong></div>
                      {Object.entries(avgByDepth || {}).map(([depth, v]) => (
                        <div key={depth}>
                          <strong>{depth} cm</strong>: {v.toFixed(2)}
                          {dataOption === 'Temperature' ? ' °C' : ' %'}
                        </div>
                      ))}
                    </Popup>
                  </CircleMarker>
                );
              })}

          </React.Fragment>
        );
      })}

  {['SOC', 'pH', 'Temperature', 'Moisture'].includes(dataOption) && (
        <Legend
          selectedData={dataOption}
          colorScale={colorScale}
          minVal={minVal}
          maxVal={maxVal}
        />
      )}
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
              sampleCount: s.sample_count,
              pH: s.ph
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
                    onClick={() => scrollTo(item.key)}
                  >
                    {item.label}
                  </button>
                )}

                {item.key === 'catchment' && (
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
                      onSensorClose={() => setSensorSeries(null)}
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
        </section>
      </main>
    </div >
  );
}
