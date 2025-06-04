import { useState, useEffect, useRef } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css';
import About from './components/sections/About';
import Catchment from './components/sections/Catchment';
import Cover from './components/sections/Cover';
import SideBar from './components/sections/SideBar';

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
  'Cd/Cas': { name: 'Caricion davallianae', color: '#5ab4ac' },
  Cfu: { name: 'Caricion fuscae', color: '#01665e' },
};

// Define bounds for Switzerland and Valais
const DEFAULT_COLOUR = '#000000';
const BOUNDS_SWITZERLAND = [[45.0, 5.0], [48.5, 11.5]];
const CENTROID_VALAIS = [46.55, 7.25];



export default function App() {
  const [areas, setAreas] = useState([]);
  const [activeAreaId, setActiveAreaId] = useState(null);
  const [selectedData, setSelectedData] = useState(null);
  const [viewMode, setViewMode] = useState('experimental');
  const [sensorSeries, setSensorSeries] = useState(null);
  const sensorCacheRef = useRef({});
  const [shouldRecenter, setShouldRecenter] = useState(false);
  const sectionsRef = useRef([]);

  const handleSensorClick = async (sensorId) => {
    const cacheKey = `${sensorId}_${selectedData}`;
    const cached = sensorCacheRef.current[cacheKey];
    if (cached) {
      setSensorSeries(cached);
      return;
    }

    let endpoint;
    if (selectedData === 'Temperature') {
      endpoint = `/api/public/sensors/${sensorId}/temperature`;
    } else if (selectedData === 'Moisture') {
      endpoint = `/api/public/sensors/${sensorId}/moisture`;
    } else {
      return;
    }

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Failed to load sensor data (${res.status})`);
      const json = await res.json();
      sensorCacheRef.current[cacheKey] = json;
      setSensorSeries(json);
    } catch (err) {
      console.error(err);
    }
  };

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
  };

  const selectData = key => {
    setSensorSeries(null);
    setSelectedData(key);
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
              pH: s.ph,
            };
          }),
        }));
        setAreas(enriched);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeAreaId) return;
    const firstKey = viewMode === 'experimental'
      ? dataOptions[0].key
      : modelOptions[0].key;
    setSelectedData(firstKey);
  }, [viewMode, activeAreaId]);

  // Prevent section swapping when scrolling inside Leaflet popups
  useEffect(() => {
    const handleGlobalWheel = (event) => {
      // Check if the event target is inside a Leaflet popup
      if (event.target.closest('.leaflet-popup')) {
        event.stopPropagation();
        event.preventDefault();
      }
    };

    // Add event listener with capture=true to intercept before other handlers
    document.addEventListener('wheel', handleGlobalWheel, { capture: true, passive: false });
    document.addEventListener('touchmove', handleGlobalWheel, { capture: true, passive: false });

    return () => {
      document.removeEventListener('wheel', handleGlobalWheel, { capture: true });
      document.removeEventListener('touchmove', handleGlobalWheel, { capture: true });
    };
  }, []);

  return (
    <div className="App">
      <SideBar
        sectionsRef={sectionsRef}
        areas={areas}
        activeAreaId={activeAreaId}
        selectedData={selectedData}
        viewMode={viewMode}
        selectArea={selectArea}
        clearArea={clearArea}
        selectData={selectData}
        setViewMode={setViewMode}
      />

      <main className="sections">
        <Cover sectionsRef={sectionsRef}/>
        <Catchment
          areas={areas}
          activeAreaId={activeAreaId}
          selectedData={selectedData}
          viewMode={viewMode}
          selectArea={selectArea}
          handleSensorClick={handleSensorClick}
          sensorSeries={sensorSeries}
          setSensorSeries={setSensorSeries}
          setShouldRecenter={setShouldRecenter}
          shouldRecenter={shouldRecenter}
          sectionsRef={sectionsRef}
          bounds={BOUNDS_SWITZERLAND}
          centroid={CENTROID_VALAIS}
          soilTypeMappings={soilTypeMappings}
          vegetationMappings={vegetationMappings}
          defaultColour={DEFAULT_COLOUR}
        />
        <About sectionsRef={sectionsRef} />
      </main>
    </div>
  );
}
