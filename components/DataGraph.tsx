
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { HistoricalDataPoint } from '../types';

interface DataGraphProps {
  data: HistoricalDataPoint[];
  sensorIds: string[];
  doorSensorIds: string[];
  sensorInfo: Map<string, string>;
}

const SENSOR_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#d0ed57', '#a4de6c'];
const DOOR_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#EAB308']; // Red, Orange, Amber, Yellow

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const date = new Date(label).toLocaleString();
      const tempPayloads = payload.filter(p => p.dataKey && p.dataKey.startsWith('temp_'));
      const doorPayloads = payload.filter(p => p.dataKey && p.dataKey.startsWith('door_'));

      return (
        <div className="bg-white p-2 border border-gray-200 rounded shadow-lg text-sm">
          <p className="font-bold mb-1">{`${date}`}</p>
          {tempPayloads.map(p => (
              <p style={{ color: p.stroke }} key={p.dataKey}>
                  {p.name}: {typeof p.value === 'number' ? `${p.value.toFixed(1)}°C` : 'N/A'}
              </p>
          ))}
          {doorPayloads.map(p => (
            <p style={{ color: p.stroke }} key={p.dataKey}>
              {p.name}: {typeof p.value === 'number' ? (p.value === 1 ? 'Open' : 'Closed') : 'N/A'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

const DataGraph: React.FC<DataGraphProps> = ({ data, sensorIds, doorSensorIds, sensorInfo }) => {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500">No data available for this period.</div>
  }

  // Flatten the data for easier consumption by Recharts
  const graphData = useMemo(() => {
    return data.map(point => {
        const flatPoint: any = {
            timestamp: point.timestamp,
        };
        sensorIds.forEach(id => {
            flatPoint[`temp_${id}`] = point.temperatures?.[parseInt(id, 10)]?.value ?? null;
        });
        doorSensorIds.forEach(id => {
            flatPoint[`door_${id}`] = point.doorStatus?.[parseInt(id, 10)] ?? null;
        });
        return flatPoint;
    });
  }, [data, sensorIds, doorSensorIds]);
  
  const hasTemperatureData = sensorIds.length > 0;
  const hasDoorData = doorSensorIds.length > 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={graphData}
        margin={{
          top: 5,
          right: 30,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          type="number"
          domain={['dataMin', 'dataMax']}
          stroke="rgb(156 163 175)"
        />
        {hasTemperatureData && <YAxis yAxisId="left" label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fill: '#374151' }} stroke="#374151" />}
        {hasDoorData && <YAxis yAxisId="right" orientation="right" domain={[-0.1, 1.1]} axisLine={false} tickLine={false} tick={false} />}
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {sensorIds.map((id, index) => (
            <Line
                key={`temp-${id}`}
                yAxisId="left"
                type="monotone"
                dataKey={`temp_${id}`}
                stroke={SENSOR_COLORS[index % SENSOR_COLORS.length]}
                dot={false}
                name={sensorInfo.get(id) || `Sensor ${id}`}
                connectNulls
            />
        ))}
        {doorSensorIds.map((id, index) => (
            <Line
                key={`door-${id}`}
                yAxisId="right"
                type="stepAfter"
                dataKey={`door_${id}`}
                stroke={DOOR_COLORS[index % DOOR_COLORS.length]}
                strokeWidth={2}
                dot={false}
                name={`Door ${id}`}
                connectNulls
            />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default DataGraph;