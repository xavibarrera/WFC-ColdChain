
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
      return (
        <div className="bg-white dark:bg-gray-700 p-2 border border-gray-200 dark:border-gray-600 rounded shadow-lg">
          <p className="label text-sm text-gray-600 dark:text-gray-300">{`${date}`}</p>
          <p className="intro text-blue-500">{`Temp: ${payload[0].value}°C`}</p>
          <p className="intro text-red-500">{`Door: ${payload[1].value === 1 ? 'Open' : 'Closed'}`}</p>
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
        <Line yAxisId="left" type="monotone" dataKey="temperature" stroke="#8884d8" dot={false} name="Temperature" />
        <Area yAxisId="right" type="step" dataKey="doorStatus" fill="#ef4444" stroke="#ef4444" fillOpacity={0.2} name="Door Open" />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default DataGraph;
