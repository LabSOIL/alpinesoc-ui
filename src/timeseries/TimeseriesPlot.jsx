import React from 'react';
import Plot from 'react-plotly.js';

export default function TimeseriesPlot({ series, dataOption }) {
    // pick the correct field
    const key =
        dataOption === 'Temperature'
            ? 'average_temperature_by_depth_cm'
            : 'average_moisture_by_depth_cm';
    const byDepth = series[key] || {};

    // build one trace per depth
    const traces = Object.entries(byDepth).map(([depth, records]) => ({
        x: records.map(r => r.time_utc),
        y: records.map(r => r.y),
        name: `${depth} cm`,
        type: 'scatter',
        mode: 'lines',
    }));

    if (traces.length === 0) {
        return <div>No {dataOption.toLowerCase()} data available.</div>;
    }

    return (
        <Plot
            data={traces}
            layout={{
                title: `${series.name} — ${dataOption}`,
                xaxis: { title: 'Time (UTC)' },
                yaxis: { title: dataOption },
                legend: { orientation: 'h', xanchor: 'center', x: 0.5, y: -0.2 },
                margin: { t: 40, b: 40, l: 50, r: 20 },
            }}
            style={{ width: '100%', height: '200px' }}
            config={{ responsive: true }}
        />
    );
}
