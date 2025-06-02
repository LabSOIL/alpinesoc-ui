import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css'


export default function Legend({ dataOption, title, colorScale, minVal, maxVal, soilTypeMappings, vegetationMappings }) {
  
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

        container.innerHTML = `<h4 style="margin:0 0 .5em; padding:0; text-align:center">${title}</h4>`;

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
          <h4 style="margin:0 0 .5em; padding:0; text-align:center; white-space:normal">
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
