import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import {
  MapContainer,
  Popup,
  Polygon,
  CircleMarker,
  Tooltip,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import 'leaflet/dist/leaflet.css';
import { BaseLayers } from './maps/Layers';
import chroma from 'chroma-js';

const initialMenuItemsConfig = [
  { key: 'cover', label: 'Home' },
  { key: 'catchment', label: 'Catchment', subItems: [] },
  { key: 'data', label: 'Data', subItems: [] },
  { key: 'experimental', label: 'Experimental View' },
];

const dataOptions = [
  { key: 'SOC', color: '#e41a1c' },
  { key: 'pH', color: '#377eb8' },
  { key: 'T', color: '#4daf4a' },
  { key: 'Soil moisture', color: '#984ea3' },
];
const dataAccessors = {
  SOC: plot => plot.socStock,
  pH: plot => plot.pH,
  T: plot => plot.temperature,
  'Soil moisture': plot => plot.soilMoisture,
};

const flipCoordinates = coords => coords.map(([lng, lat]) => [lat, lng]);
const flipPolygonCoordinates = geom =>
  geom.coordinates.map(ring => flipCoordinates(ring));

function Legend({ selectedData, areas, activeAreaId }) {
  const map = useMap();

  // Viridis colour scale helper
  const getColorOnScale = (value, min, max) => {
    return chroma
      .scale('viridis')
      .domain([min, max])(value)
      .hex();
  };

  useEffect(() => {
    document.querySelectorAll('.info.legend').forEach(el => el.remove());
    if (!selectedData) return;

    const accessor = dataAccessors[selectedData];
    if (!accessor) return;

    let plots = [];
    if (activeAreaId) {
      const area = areas.find(a => a.id === activeAreaId);
      plots = area?.plots || [];
    } else {
      plots = areas.flatMap(a => a.plots);
    }
    const values = plots.map(accessor).filter(v => typeof v === 'number');
    if (!values.length) return;

    const minVal = Math.floor(Math.min(...values));
    const maxVal = Math.ceil(Math.max(...values));
    const midVal = Math.round((minVal + maxVal) / 2);

    const staticColor = dataOptions.find(o => o.key === selectedData)?.color;
    let gradientStyle;

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


function CatchmentLayers({
  areas,
  activeAreaId,
  dataOption,
  onAreaClick,
  recenterSignal,
  onRecenterHandled
}) {
  const map = useMap();
  const [hasZoomed, setHasZoomed] = useState(false);


  // Compute dynamic range for selected metric
  const { minVal, maxVal } = useMemo(() => {
    if (!dataOption) return { minVal: 0, maxVal: 1 };
    const accessor = dataAccessors[dataOption];
    let plots = [];
    if (activeAreaId) {
      const area = areas.find(a => a.id === activeAreaId);
      plots = area?.plots || [];
    } else {
      plots = areas.flatMap(a => a.plots);
    }
    const values = plots.map(accessor).filter(v => typeof v === 'number');
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    return { minVal: Math.floor(min), maxVal: Math.ceil(max) };
  }, [areas, activeAreaId, dataOption]);

  // Viridis colour scale
  const getColor = value => {
    return chroma
      .scale('viridis')
      .domain([minVal, maxVal])(value)
      .hex();
  };

  useEffect(() => {
    if (!areas.length || !recenterSignal) return;
    setHasZoomed(false);

    let coords = [];
    if (activeAreaId) {
      const a = areas.find(x => x.id === activeAreaId);
      if (a?.geom?.coordinates) coords = flipPolygonCoordinates(a.geom).flat();
    } else {
      areas.forEach(a => {
        if (a.geom?.coordinates) coords.push(...flipPolygonCoordinates(a.geom).flat());
      });
    }

    const doFly = () => {
      if (coords.length) {
        map.flyToBounds(
          L.latLngBounds(coords).pad(0.2),
          { duration: 1 }
        );
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
      {areas.map(area => area.geom?.coordinates && (
        <React.Fragment key={area.id}>
          <Polygon
            positions={flipPolygonCoordinates(area.geom)}
            pathOptions={{
              fillOpacity: area.id === activeAreaId ? 0.5 : 0.25,
              color: area.id === activeAreaId ? '#2b8cbe' : '#3388ff', // unchanged
            }}
            eventHandlers={
              area.id === activeAreaId && hasZoomed
                ? {}                            // disable click and fly to on the polygon when it is already zoomed into the area
                : { click: () => onAreaClick(area.id, true) }
            }
          >
            {area.id !== activeAreaId && (
              <Tooltip permanent interactive eventHandlers={{ click: () => onAreaClick(area.id, true) }}>
                {area.name}
              </Tooltip>
            )}
          </Polygon>

          {area.id === activeAreaId && hasZoomed && area.plots.map(plot => {
            const coord = plot.geom?.['4326'];
            if (!coord) return null;
            const { x: lon, y: lat } = coord;
            const accessor = dataAccessors[dataOption];
            const value = accessor(plot);
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
                  SOC stock: {plot.socStock.toFixed(1)} Mg ha⁻¹<br />
                </Popup>
              </CircleMarker>
            );
          })}
        </React.Fragment>
      ))}
      <Legend selectedData={dataOption} areas={areas} activeAreaId={activeAreaId} />
    </>
  );
}

// {area.id === activeAreaId && hasZoomed && area.plots.map(plot => {
//   const coord = plot.geom?.['4326'];
//   if (!coord) return null;
//   const { x: lon, y: lat } = coord;
//   const value = dataOption === 'SOC' ? plot.socStock : dataAccessors[dataOption](plot);
//   const color = dataOption === 'SOC' ? getColor(value) : markerStatic;

//   return (
//     <CircleMarker
//       key={plot.id}
//       center={[lat, lon]}
//       pathOptions={{ color, fillColor: color, fillOpacity: 1 }}
//       radius={Math.sqrt(plot.socStock)}
//     >
//       <Popup>
//         <strong>{plot.name}</strong><br />
//         Total depth: {plot.totalDepth} cm<br />
//         Samples: {plot.sampleCount}<br />
//         <hr />
//         Mean C: {plot.meanC.toFixed(2)} %<br />
//         SOC stock: {plot.socStock.toFixed(1)} Mg ha⁻¹<br />
//         {/* pH: {plot.pH.toFixed(2)}<br /> */}
//         {/* Temperature: {plot.temperature.toFixed(1)} °C<br /> */}
//         {/* Soil moisture: {plot.soilMoisture.toFixed(1)} %<br /> */}
//       </Popup>
//     </CircleMarker>
//   );
// })}
// </React.Fragment>
// ) : null
// )}
// <Legend selectedData={dataOption} areas={areas} activeAreaId={activeAreaId} />
// </>
// );
// }
export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('cover');
  const [activeAreaId, setActiveAreaId] = useState(null);
  const [selectedData, setSelectedData] = useState(null);
  const [menuItems, setMenuItems] = useState(initialMenuItemsConfig);
  const [areas, setAreas] = useState([]);
  const [shouldRecenter, setShouldRecenter] = useState(false);
  const sectionsRef = useRef([]);
  const [stockRange, setStockRange] = useState([0, 0]);

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
            const s = plot.aggregated_samples['1']; // Use only the first replicate set
            return {
              ...plot,
              socStock: s.soc_stock_megag_per_hectare,
              meanC: s.mean_c,
              totalDepth: s.total_depth,
              // pH: s.pH,
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

  useEffect(() => {
    if (activeSection === 'catchment' && areas.length) {
      const subs = areas.map(a => ({ key: a.id, label: a.name }));
      setMenuItems(m =>
        m.map(i => i.key === 'catchment' ? { ...i, subItems: subs } : i)
      );
    }
  }, [activeSection, areas]);


  useEffect(() => {
    setMenuItems(m => m.map(i =>
      i.key === 'data'
        ? {
          ...i,
          subItems: activeAreaId
            ? dataOptions.map(o => ({ key: o.key, label: o.key }))
            : []
        }
        : i
    ));
  }, [activeAreaId]);

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
    setSelectedData(dataOptions[0].key);
  };
  const clearArea = () => {
    setActiveAreaId(null);
    setSelectedData(null);
    setShouldRecenter(true);
    scrollTo('catchment');
  };
  const selectData = key => setSelectedData(key);

  const activeArea = areas.find(a => a.id === activeAreaId);

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
                >{item.label}</button>

                {item.key === 'catchment' && (
                  <ul className="sub-menu">
                    {activeAreaId
                      ? <li className="active-area">
                        <span className="selected-area">
                          {activeArea?.name}
                          <button
                            className="remove-selected"
                            onClick={clearArea}
                          >✕</button>
                        </span>
                      </li>
                      : item.subItems.map(s => (
                        <li key={s.key}>
                          <button
                            className="submenu-btn"
                            onClick={() => selectArea(s.key, true)}
                          >{s.label}</button>
                        </li>
                      ))
                    }
                  </ul>
                )}

                {item.key === 'data' && activeAreaId && (
                  <ul className="sub-menu">
                    {item.subItems.map(s => (
                      <li key={s.key}>
                        <button
                          className={`submenu-btn ${selectedData === s.key ? 'active-data' : ''}`}
                          onClick={() => selectData(s.key)}
                        >{s.label}</button>
                      </li>
                    ))}
                  </ul>
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
          >↓</button>
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
          <h2>{activeArea ? activeArea.name : 'Catchment'}</h2>
          <div className="map-wrapper">
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
                stockRange={stockRange}
                onAreaClick={selectArea}
                recenterSignal={shouldRecenter}
                onRecenterHandled={() => setShouldRecenter(false)}
              />
            </MapContainer>
          </div>
        </section>

        {/* EXPERIMENTAL */}
        <section
          className="section"
          data-section="experimental"
          ref={el => sectionsRef.current[2] = el}
        >
          <h2>Experimental View</h2>
          <div className="map-wrapper">
            <MapContainer center={[46.326, 7.808]} zoom={12} scrollWheelZoom className="leaflet-container">
              <BaseLayers />
              {areas.map(a => a.geom?.coordinates && (
                <Polygon
                  key={a.id}
                  positions={flipPolygonCoordinates(a.geom)}
                  pathOptions={{ fillOpacity: 0.25, color: '#3388ff' }}
                />
              ))}
            </MapContainer>
          </div>
        </section>
      </main>
    </div>
  );
}
