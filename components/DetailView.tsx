import React, { useState, useEffect, useCallback } from 'react';
import { AuthCredentials, Vehicle, HistoricalDataPoint } from '../types';
import WebfleetService from '../services/webfleetService';
import DataGraph from './DataGraph';
import { IconDownload } from '../constants';

// Declare global libraries loaded via CDN
declare const jspdf: any;
declare const html2canvas: any;

interface DetailViewProps {
  auth: AuthCredentials;
  vehicle: Vehicle;
  onBack: () => void;
}

const Spinner: React.FC = () => (
    <div className="flex justify-center items-center h-full">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-500"></div>
    </div>
);

const PdfSpinner: React.FC = () => (
  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
);

const rangeOptions = [
    { value: 'd0', label: 'Today' },
    { value: 'd-1', label: 'Yesterday' },
    { value: 'wf0', label: 'Last 7 Days' },
    { value: 'w0', label: 'Current Week' },
    { value: 'w-1', label: 'Last Week' },
    { value: 'm0', label: 'Current Month' },
    { value: 'm-1', label: 'Last Month' },
];

const RangeSelector: React.FC<{
    selectedRange: string;
    onRangeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}> = React.memo(({ selectedRange, onRangeChange }) => {
    return (
        <div className="flex items-center gap-2">
            <label htmlFor="range-pattern" className="text-sm font-medium text-gray-600">Date Range:</label>
            <select
                id="range-pattern"
                name="rangePattern"
                value={selectedRange}
                onChange={onRangeChange}
                className="bg-white border border-gray-300 rounded-md py-2 px-3 text-sm text-gray-900 focus:ring-red-500 focus:border-red-500"
                aria-label="Select Date Range"
            >
                {rangeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </div>
    );
});
RangeSelector.displayName = 'RangeSelector';


const DetailView: React.FC<DetailViewProps> = ({ auth, vehicle, onBack }) => {
  const [rangePattern, setRangePattern] = useState('d0'); // Default to 'Today'
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRangePattern(e.target.value);
  };
  
  const handleDownloadPdf = async () => {
    if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        setError('PDF generation library is not loaded.');
        return;
    }
    setIsDownloading(true);
    setError(null);
    try {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        const graphElement = document.getElementById('datagraph-container');
        if (!graphElement) {
            throw new Error('Graph element not found.');
        }

        doc.setFontSize(22);
        doc.text('Cold Chain Report', 14, 22);
        
        doc.setFontSize(12);
        const rangeLabel = rangeOptions.find(o => o.value === rangePattern)?.label ?? rangePattern;
        doc.text(`Vehicle: ${vehicle.name}`, 14, 32);
        doc.text(`Date Range: ${rangeLabel}`, 14, 38);
        
        const canvas = await html2canvas(graphElement, { 
            backgroundColor: '#ffffff' 
        });
        const imgData = canvas.toDataURL('image/png');
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const imgWidth = pdfWidth - 28;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        doc.addImage(imgData, 'PNG', 14, 48, imgWidth, imgHeight);

        if (data.length > 0) {
            const tableColumn = ["Timestamp", "Temperature (°C)", "Door Status", "Location"];
            const tableRows = data.map(item => [
                new Date(item.timestamp).toLocaleString(),
                item.temperature !== null ? item.temperature.toFixed(1) : 'N/A',
                item.doorStatus === 1 ? 'Open' : 'Closed',
                item.location ? item.location.address : 'N/A',
            ]);

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: imgHeight + 60,
                theme: 'grid',
                headStyles: { fillColor: [228, 0, 43] },
            });
        }


        doc.save(`report-${vehicle.name.replace(/\s/g, '_')}-${rangePattern}.pdf`);

    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate PDF.');
    } finally {
        setIsDownloading(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await WebfleetService.getHistoricalData(auth, vehicle.uid, rangePattern);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch historical data.');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [auth, vehicle.uid, rangePattern]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <button 
          onClick={onBack} 
          className="mb-4 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          <span className="material-icons" style={{ fontSize: '20px' }}>arrow_back</span>
          Back to Dashboard
        </button>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{vehicle.name}</h2>
              <p className="text-gray-500">{vehicle.type} - {vehicle.uid}</p>
            </div>
             <div className="flex items-center gap-4">
                <RangeSelector selectedRange={rangePattern} onRangeChange={handleRangeChange} />
                <button
                    onClick={handleDownloadPdf}
                    disabled={isDownloading || isLoading || data.length === 0}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {isDownloading ? <PdfSpinner/> : <IconDownload className="h-5 w-5" />}
                    {isDownloading ? 'Generating...' : 'Download PDF'}
                </button>
            </div>
          </div>
           {error && <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-md">{error}</p>}
          <div id="datagraph-container" className="h-96">
            {isLoading ? <Spinner /> : <DataGraph data={data} />}
          </div>
          {data.length > 0 && !isLoading && (
            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Historical Data Log</h3>
              <div className="overflow-auto max-h-96 relative border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Temperature
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Door Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Location
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((point, index) => (
                      <tr key={`${point.timestamp}-${index}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(point.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {point.temperature !== null ? `${point.temperature.toFixed(1)}°C` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {point.doorStatus === 1 ? 'Open' : 'Closed'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {point.location ? point.location.address : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailView;