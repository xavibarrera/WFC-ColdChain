
import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { HistoricalDataPoint } from '../types';

interface DataGraphProps {
  data: HistoricalDataPoint[];
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const date = new Date(label).toLocaleString();
      const tempData = payload.find(p => p.dataKey === 'temperature');
      const doorData = payload.find(p => p.dataKey === 'doorStatus');

      return (
        <div className="bg-white p-2 border border-gray-200 rounded shadow-lg">
          <p className="label text-sm text-gray-600">{`${date}`}</p>
          <p className="intro text-blue-500">
            {'Temp: '}
            {tempData && typeof tempData.value === 'number'
              ? `${tempData.value.toFixed(1)}°C`
              : 'N/A'}
          </p>
          <p className="intro text-red-500">
            {'Door: '}
            {doorData && typeof doorData.value === 'number'
              ? (doorData.value === 1 ? 'Open' : 'Closed')
              : 'N/A'}
          </p>
        </div>
      );
    }
    return null;
  };

const DataGraph: React.FC<DataGraphProps> = ({ data }) => {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500">No data available for this period.</div>
  }
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
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
          tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString()}
          type="number"
          domain={['dataMin', 'dataMax']}
          stroke="rgb(156 163 175)"
        />
        <YAxis yAxisId="left" label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fill: '#8884d8' }} stroke="#8884d8" />
        <YAxis yAxisId="right" orientation="right" tick={false} stroke="#82ca9d" />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="temperature" stroke="#8884d8" dot={false} name="Temperature" connectNulls />
        <Area yAxisId="right" type="step" dataKey="doorStatus" fill="#ef4444" stroke="#ef4444" fillOpacity={0.2} name="Door Open" />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default DataGraph;