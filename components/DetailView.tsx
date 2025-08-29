import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthCredentials, Vehicle, HistoricalDataPoint, Trip } from '../types';
import WebfleetService from '../services/webfleetService';
import DataGraph from './DataGraph';
import { IconDownload, IconTicket, IconDocumentReport } from '../constants';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';


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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGeneratingTicket, setIsGeneratingTicket] = useState(false);
  const [isGeneratingDoorReport, setIsGeneratingDoorReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'trips'>('overview');

  const { sensorIds, sensorInfo, doorSensorIds } = useMemo(() => {
    const tempIds = new Set<string>();
    const tempInfo = new Map<string, string>();
    const doorIds = new Set<string>();

    data.forEach(point => {
        if (point.temperatures) {
            for (const id in point.temperatures) {
                if (Object.prototype.hasOwnProperty.call(point.temperatures, id)) {
                    if (!tempIds.has(id)) {
                        tempIds.add(id);
                        tempInfo.set(id, point.temperatures[id].name);
                    }
                }
            }
        }
        if (point.doorStatus) {
            for (const id in point.doorStatus) {
                 if (Object.prototype.hasOwnProperty.call(point.doorStatus, id)) {
                    doorIds.add(id);
                 }
            }
        }
    });

    return {
        sensorIds: Array.from(tempIds).sort((a,b) => parseInt(a, 10) - parseInt(b, 10)),
        sensorInfo: tempInfo,
        doorSensorIds: Array.from(doorIds).sort((a,b) => parseInt(a, 10) - parseInt(b, 10)),
    };
  }, [data]);
  
  const doorEvents = useMemo(() => {
    if (!data || data.length === 0) return [];

    const events: HistoricalDataPoint[] = [];
    let lastKnownStatuses: { [id: number]: 0 | 1 } | null = null;

    for (const point of data) {
        const currentStatuses = point.doorStatus;
        if (currentStatuses && Object.keys(currentStatuses).length > 0) {
            const hasChanged = !lastKnownStatuses || 
                Object.keys(currentStatuses).some(id => currentStatuses[id] !== lastKnownStatuses?.[id]) ||
                Object.keys(lastKnownStatuses || {}).length !== Object.keys(currentStatuses).length;

            if (hasChanged) {
                events.push(point);
                lastKnownStatuses = { ...(lastKnownStatuses || {}), ...currentStatuses };
            }
        } else if (lastKnownStatuses) { 
            events.push(point);
            lastKnownStatuses = null;
        }
    }
    
    return events;
  }, [data]);

  const hasDoorStatusData = useMemo(() => {
    return doorSensorIds.length > 0;
  }, [doorSensorIds]);
  
  const hasTemperatureData = useMemo(() => {
      return sensorIds.length > 0;
  }, [sensorIds]);

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRangePattern(e.target.value);
  };

  const handleGenerateDoorReport = async () => {
    let eventsToReport: HistoricalDataPoint[] = doorEvents;
    
    if (doorEvents.length === 0 && hasDoorStatusData) {
        const firstEvent = data.find(p => p.doorStatus && Object.keys(p.doorStatus).length > 0);
        if (firstEvent) {
            eventsToReport = [firstEvent];
        }
    }

    if (eventsToReport.length === 0) {
        setError("No door status data found in this period.");
        return;
    }

    if (typeof jspdf === 'undefined' || typeof (new jspdf.jsPDF()).autoTable === 'undefined') {
        setError('PDF generation library is not loaded.');
        return;
    }

    setIsGeneratingDoorReport(true);
    setError(null);

    try {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.text('Door Status Report', 14, 22);
        
        doc.setFontSize(12);
        const rangeLabel = rangeOptions.find(o => o.value === rangePattern)?.label ?? rangePattern;
        doc.text(`Vehicle: ${vehicle.name}`, 14, 32);
        doc.text(`Date Range: ${rangeLabel}`, 14, 38);

        const tableHead: string[] = ["Timestamp"];
        doorSensorIds.forEach(id => tableHead.push(`Door D${id}`));
        if (hasTemperatureData) {
            sensorIds.forEach(id => tableHead.push(`${sensorInfo.get(id) || `Sensor ${id}`} (°C)`));
        }
        tableHead.push("Location");

        const tableRows = eventsToReport.map(item => {
            const row: string[] = [
                new Date(item.timestamp).toLocaleString(),
            ];
            doorSensorIds.forEach(id => {
                const status = item.doorStatus?.[id];
                row.push(status === 1 ? 'Open' : (status === 0 ? 'Closed' : 'N/A'));
            });
            if (hasTemperatureData) {
                sensorIds.forEach(id => {
                    const temp = item.temperatures?.[id];
                    row.push(typeof temp?.value === 'number' ? temp.value.toFixed(1) : 'N/A');
                });
            }
            row.push(item.location ? item.location.address : 'N/A');
            return row;
        });

        doc.autoTable({
            head: [tableHead],
            body: tableRows,
            startY: 48,
            theme: 'grid',
            headStyles: { fillColor: [34, 139, 34] }, // A green color
        });

        doc.save(`door-report-${vehicle.name.replace(/\s/g, '_')}-${rangePattern}.pdf`);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate door report.');
    } finally {
        setIsGeneratingDoorReport(false);
    }
  };

  const handleGenerateThermographTicket = async () => {
    if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined' || typeof (new jspdf.jsPDF()).autoTable === 'undefined') {
        setError('PDF generation library is not loaded.');
        return;
    }

    const ticketSensorInfo = new Map<string, string>();
    const tempDataPoints = data.filter(p => {
        if (p.temperatures && Object.keys(p.temperatures).length > 0) {
            Object.entries(p.temperatures).forEach(([id, reading]) => {
                if (!ticketSensorInfo.has(id)) {
                    ticketSensorInfo.set(id, reading.name);
                }
            });
            return true;
        }
        return false;
    });

    if (tempDataPoints.length === 0) {
        setError("No temperature data available to generate a ticket.");
        return;
    }

    setIsGeneratingTicket(true);
    setError(null);

    try {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        
        const ticketSensorIds = Array.from(ticketSensorInfo.keys()).sort((a,b)=> parseInt(a, 10)-parseInt(b, 10));

        const formatDateForTicketHeader = (ts: number) => {
            const d = new Date(ts);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
        };

        let lastDate = '';
        const tableRows = tempDataPoints.map((point, index) => {
            const date = new Date(point.timestamp);
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const hh = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            const currentDate = `${yyyy}-${mm}-${dd}`;
            let dateString = `${hh}:${min}`;
            if (currentDate !== lastDate) {
                dateString = `${currentDate} ${dateString}`;
                lastDate = currentDate;
            }
            
            const row: any[] = [
                { content: (index + 1).toString() + '.', styles: { halign: 'right', cellWidth: 12 } },
                { content: dateString, styles: { halign: 'center' } }
            ];
            ticketSensorIds.forEach(id => {
                const temp = point.temperatures?.[id];
                row.push({ 
                    content: typeof temp?.value === 'number' ? temp.value.toFixed(1) : '-',
                    styles: { halign: 'center' }
                });
            });
            return row;
        });

        const totalPagesExp = '{total_pages_count_string}';
        
        const tableHead = [['#', 'Timestamp']];
        ticketSensorIds.forEach(id => tableHead[0].push(`${ticketSensorInfo.get(id) || `Sensor ${id}`} (°C)`));

        doc.autoTable({
            head: tableHead,
            body: tableRows,
            theme: 'plain',
            styles: { font: 'courier', fontSize: 9, cellPadding: 0.8 },
            headStyles: { halign: 'center', valign: 'middle', fontStyle: 'normal', lineWidth: { bottom: 0.2 }, lineColor: [0, 0, 0], fillColor: [255, 255, 255], textColor: [0, 0, 0] },
            margin: { top: 65, bottom: 25 },
            didDrawPage: function (data: any) {
                doc.setFont('courier', 'bold');
                doc.setFontSize(16);
                doc.text('Thermograph Report', data.settings.margin.left, 20);
                doc.setFont('courier', 'normal');
                doc.setFontSize(10);
                const generationDate = new Date().toLocaleString('sv-SE').replace('T', ' ');
                doc.text(`Generated on:    ${generationDate}`, data.settings.margin.left, 28);
                doc.text(`Vehicle:         ${vehicle.name}`, data.settings.margin.left, 38);
                doc.text(`Company:         `, data.settings.margin.left, 42);
                const startStr = formatDateForTicketHeader(tempDataPoints[0].timestamp);
                const endStr = formatDateForTicketHeader(tempDataPoints[tempDataPoints.length - 1].timestamp);
                doc.text(`Report Period:   from ${startStr} to ${endStr}`, data.settings.margin.left, 52);
                
                doc.setFontSize(9);
                doc.text(`Page ${data.pageNumber} of ${totalPagesExp}`, data.settings.margin.left, doc.internal.pageSize.height - 15);
            },
        });
        
        if (typeof doc.putTotalPages === 'function') {
            doc.putTotalPages(totalPagesExp);
        }

        doc.save(`thermograph-report-${vehicle.name.replace(/\s/g, '_')}-${rangePattern}.pdf`);

    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate report.');
    } finally {
        setIsGeneratingTicket(false);
    }
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
            const tableHead: string[] = ["Timestamp"];
            if (hasTemperatureData) {
                sensorIds.forEach(id => tableHead.push(`${sensorInfo.get(id) || `Temp S${id}`} (°C)`));
            }
            if (hasDoorStatusData) {
                doorSensorIds.forEach(id => tableHead.push(`Door D${id}`));
            }
            tableHead.push("Location");

            const tableRows = data.map(item => {
                const row: string[] = [
                    new Date(item.timestamp).toLocaleString(),
                ];
                if (hasTemperatureData) {
                    sensorIds.forEach(id => {
                        const temp = item.temperatures?.[id];
                        row.push(typeof temp?.value === 'number' ? temp.value.toFixed(1) : 'N/A');
                    });
                }
                if (hasDoorStatusData) {
                    doorSensorIds.forEach(id => {
                        const status = item.doorStatus?.[id];
                        row.push(status === 1 ? 'Open' : (status === 0 ? 'Closed' : 'N/A'));
                    });
                }
                row.push(
                    item.location ? item.location.address : 'N/A'
                );
                return row;
            });

            doc.autoTable({
                head: [tableHead],
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
      const [historicalResult, tripsResult] = await Promise.all([
          WebfleetService.getHistoricalData(auth, { objectuid: vehicle.uid, rangePattern }),
          WebfleetService.getTrips(auth, vehicle.uid, rangePattern)
      ]);
      setData(historicalResult);
      setTrips(tripsResult.sort((a, b) => b.startTime - a.startTime));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch historical data.');
      setData([]);
      setTrips([]);
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
        <div className="bg-app-content rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{vehicle.name}</h2>
              <p className="text-gray-500">{vehicle.type} - {vehicle.uid}</p>
            </div>
             <div className="flex items-center gap-4">
                <RangeSelector selectedRange={rangePattern} onRangeChange={handleRangeChange} />
                <button
                    onClick={handleGenerateThermographTicket}
                    disabled={isGeneratingTicket || isLoading || !hasTemperatureData}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-button-report hover:bg-button-report-hover rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    aria-label="Generate Thermograph Ticket"
                >
                    {isGeneratingTicket ? <PdfSpinner/> : <IconTicket className="h-5 w-5" />}
                    {isGeneratingTicket ? 'Generating...' : 'Thermograph Report'}
                </button>
                <button
                    onClick={handleGenerateDoorReport}
                    disabled={isGeneratingDoorReport || isLoading || !hasDoorStatusData}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-button-report hover:bg-button-report-hover rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    aria-label="Generate Door Status Report"
                >
                    {isGeneratingDoorReport ? <PdfSpinner/> : <IconDocumentReport className="h-5 w-5" />}
                    {isGeneratingDoorReport ? 'Generating...' : 'Door Report'}
                </button>
                <button
                    onClick={handleDownloadPdf}
                    disabled={isDownloading || isLoading || data.length === 0}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-button-pdf hover:bg-button-pdf-hover rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    aria-label="Download Full Report as PDF"
                >
                    {isDownloading ? <PdfSpinner/> : <IconDownload className="h-5 w-5" />}
                    {isDownloading ? 'Generating...' : 'Download PDF'}
                </button>
            </div>
          </div>
           {error && activeTab === 'overview' && <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-md">{error}</p>}

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'overview'
                            ? 'border-red-500 text-red-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                        aria-current={activeTab === 'overview' ? 'page' : undefined}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('trips')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'trips'
                            ? 'border-red-500 text-red-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                        aria-current={activeTab === 'trips' ? 'page' : undefined}
                    >
                        Trip Report
                    </button>
                </nav>
            </div>
            
            <div className="mt-6">
                {isLoading ? (
                    <div className="h-96"><Spinner /></div>
                ) : activeTab === 'overview' ? (
                    <>
                        <div id="datagraph-container" className="h-96 bg-white rounded-lg shadow p-4">
                           <DataGraph data={data} sensorIds={sensorIds} doorSensorIds={doorSensorIds} sensorInfo={sensorInfo} />
                        </div>
                        {data.length > 0 && (
                          <div className="mt-8">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Historical Data Log</h3>
                            <div className="overflow-auto max-h-96 relative border border-gray-200 rounded-lg">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-app-content sticky top-0 z-10">
                                  <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                      Timestamp
                                    </th>
                                    {hasTemperatureData && sensorIds.map(id => (
                                        <th key={`temp-th-${id}`} scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                          {sensorInfo.get(id) || `Temp S${id}`} (°C)
                                        </th>
                                    ))}
                                    {hasDoorStatusData && doorSensorIds.map(id => (
                                        <th key={`door-th-${id}`} scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                          Door D{id}
                                        </th>
                                    ))}
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                      Location
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {data.map((point, index) => (
                                    <tr key={`${point.timestamp}-${index}`} className="row-hover transition-colors">
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(point.timestamp).toLocaleString()}
                                      </td>
                                      {hasTemperatureData && sensorIds.map(id => (
                                          <td key={`temp-td-${id}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                              {point.temperatures?.[id] != null 
                                                  ? `${point.temperatures[id].value.toFixed(1)}` 
                                                  : 'N/A'
                                              }
                                          </td>
                                      ))}
                                      {hasDoorStatusData && doorSensorIds.map(id => (
                                        <td key={`door-td-${id}`} className="px-6 py-4 whitespace-nowrap text-sm">
                                            {
                                                (() => {
                                                    const status = point.doorStatus?.[id];
                                                    if (status === 1) return <span className="font-semibold text-red-600">Open</span>;
                                                    if (status === 0) return <span className="font-semibold text-green-600">Closed</span>;
                                                    return <span className="text-gray-500">N/A</span>;
                                                })()
                                            }
                                        </td>
                                      ))}
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
                    </>
                ) : (
                    <>
                        {error && <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-md">{error}</p>}
                        <TripReport 
                            trips={trips} 
                            auth={auth} 
                            vehicleUid={vehicle.uid}
                            sensorInfo={sensorInfo} 
                        />
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

interface TripReportProps {
    trips: Trip[];
    auth: AuthCredentials;
    vehicleUid: string;
    sensorInfo: Map<string, string>;
}

const createTripMarkerIcon = (color: string) => {
    return new L.DivIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="${color}" stroke="white" stroke-width="1"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>`,
        className: 'bg-transparent border-0',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
};

const startIcon = createTripMarkerIcon("#22C55E"); // green-500
const endIcon = createTripMarkerIcon("#EF4444"); // red-500

interface TripMapProps {
    positions: [number, number][];
}

const TripMapUpdater: React.FC<{ bounds: L.LatLngBoundsExpression }> = ({ bounds }) => {
    const map = useMap();
    useEffect(() => {
        if (bounds && Array.isArray(bounds) && bounds.length > 0) {
            map.fitBounds(bounds, { padding: [20, 20] });
        }
    }, [bounds, map]);
    return null;
}

const TripMap: React.FC<TripMapProps> = ({ positions }) => {
    if (positions.length === 0) {
        return <div className="h-full flex items-center justify-center text-gray-500 bg-white rounded-md">No location data for this trip.</div>;
    }

    const startPoint = positions[0];
    const endPoint = positions[positions.length - 1];

    return (
        <MapContainer center={startPoint} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%', borderRadius: '8px' }}>
            <TripMapUpdater bounds={positions} />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline pathOptions={{ color: 'blue' }} positions={positions} />
            <Marker position={startPoint} icon={startIcon} />
            <Marker position={endPoint} icon={endIcon} />
        </MapContainer>
    );
};


const TripReport: React.FC<TripReportProps> = ({ trips, auth, vehicleUid, sensorInfo }) => {
    const [expandedTripId, setExpandedTripId] = useState<number | null>(null);
    const [expandedTripData, setExpandedTripData] = useState<HistoricalDataPoint[] | null>(null);
    const [isTripDetailsLoading, setIsTripDetailsLoading] = useState(false);
    const [tripDetailsError, setTripDetailsError] = useState<string | null>(null);

    const toggleTrip = useCallback(async (trip: Trip) => {
        const tripId = trip.startTime;
        if (expandedTripId === tripId) {
            setExpandedTripId(null);
            setExpandedTripData(null);
        } else {
            setExpandedTripId(tripId);
            setIsTripDetailsLoading(true);
            setTripDetailsError(null);
            setExpandedTripData(null);
            try {
                const data = await WebfleetService.getHistoricalData(auth, {
                    objectuid: vehicleUid,
                    startTime: trip.startTime,
                    endTime: trip.endTime
                });
                setExpandedTripData(data);
            } catch (error) {
                console.error("Failed to fetch trip details:", error);
                setTripDetailsError(error instanceof Error ? error.message : "Could not load trip details.");
                setExpandedTripData([]);
            } finally {
                setIsTripDetailsLoading(false);
            }
        }
    }, [auth, vehicleUid, expandedTripId]);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h > 0 ? `${h}h ` : ''}${m}m`;
    };

    if (trips.length === 0) {
        return <div className="text-center text-gray-500 py-8">No trips found for this period.</div>;
    }

    return (
        <div className="space-y-3">
            {trips.map((trip) => {
                const isExpanded = expandedTripId === trip.startTime;

                let tripDetails: {
                    stats: { [key: string]: { min: number; max: number; avg: number; } },
                    tripSensorIds: string[],
                    tripDoorSensorIds: string[],
                    tripPositions: [number, number][],
                } | null = null;
                
                if (isExpanded && expandedTripData) {
                    const tempStats: { [sensorId: string]: { min: number, max: number, avg: number, count: number, sum: number } } = {};
                    const tempIds = new Set<string>();
                    const doorIds = new Set<string>();
                    const positions: [number, number][] = [];
            
                    expandedTripData.forEach(point => {
                        if (point.temperatures) {
                            for (const sensorId in point.temperatures) {
                                tempIds.add(sensorId);
                                if (!tempStats[sensorId]) {
                                    tempStats[sensorId] = { min: Infinity, max: -Infinity, avg: 0, count: 0, sum: 0 };
                                }
                                const temp = point.temperatures[sensorId].value;
                                tempStats[sensorId].sum += temp;
                                tempStats[sensorId].count++;
                                if (temp < tempStats[sensorId].min) tempStats[sensorId].min = temp;
                                if (temp > tempStats[sensorId].max) tempStats[sensorId].max = temp;
                            }
                        }
                        if (point.doorStatus) {
                            for (const id in point.doorStatus) { doorIds.add(id); }
                        }
                        if (point.location) {
                            positions.push([point.location.lat, point.location.lng]);
                        }
                    });
            
                    for (const sensorId in tempStats) {
                        if (tempStats[sensorId].count > 0) {
                            tempStats[sensorId].avg = tempStats[sensorId].sum / tempStats[sensorId].count;
                        }
                    }

                    tripDetails = {
                        stats: tempStats,
                        tripSensorIds: Array.from(tempIds).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
                        tripDoorSensorIds: Array.from(doorIds).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
                        tripPositions: positions,
                    }
                }

                return (
                    <div key={trip.startTime} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div
                            className="p-4 cursor-pointer flex justify-between items-center bg-app-content row-hover transition-colors"
                            onClick={() => toggleTrip(trip)}
                            aria-expanded={isExpanded}
                        >
                            <div className="flex-1">
                                <p className="font-semibold text-gray-800">
                                    {new Date(trip.startTime).toLocaleString()}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">From:</span> {trip.startAddress}
                                </p>
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">To:</span> {trip.endAddress}
                                </p>
                            </div>
                            <div className="flex items-center gap-6 ml-4 text-right">
                                <div className="text-sm text-gray-700">
                                    <p>Duration</p>
                                    <p className="font-bold text-base">{formatDuration(trip.duration)}</p>
                                </div>
                                <div className="text-sm text-gray-700">
                                    <p>Distance</p>
                                    <p className="font-bold text-base">{(trip.distance / 1000).toFixed(1)} km</p>
                                </div>
                                <span className={`material-icons text-gray-500 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                            </div>
                        </div>
                        {isExpanded && (
                            <div className="p-4 border-t border-gray-200 bg-white">
                                {isTripDetailsLoading ? (
                                    <div className="h-96 flex items-center justify-center"><Spinner /></div>
                                ) : tripDetailsError ? (
                                     <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-md">{tripDetailsError}</p>
                                ) : tripDetails && (
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-md font-semibold text-gray-800 mb-3">Temperature Summary</h4>
                                            {Object.keys(tripDetails.stats).length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {Object.keys(tripDetails.stats).map(sensorId => (
                                                        <div key={sensorId} className="bg-white p-3 rounded-md border border-gray-200">
                                                            <p className="font-semibold text-gray-800">{sensorInfo.get(sensorId) || `Sensor ${sensorId}`}</p>
                                                            <div className="flex justify-between text-sm text-gray-600 mt-1">
                                                                <span>Min: <strong className="text-blue-600">{tripDetails.stats[sensorId].min.toFixed(1)}°C</strong></span>
                                                                <span>Avg: <strong className="text-green-600">{tripDetails.stats[sensorId].avg.toFixed(1)}°C</strong></span>
                                                                <span>Max: <strong className="text-red-600">{tripDetails.stats[sensorId].max.toFixed(1)}°C</strong></span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-500">No temperature data recorded for this trip.</p>
                                            )}
                                        </div>

                                        {expandedTripData && expandedTripData.length > 0 && (
                                            <div>
                                                <h4 className="text-md font-semibold text-gray-800 mb-3">Trip Graph</h4>
                                                <div className="h-72 bg-white rounded-lg shadow p-4">
                                                    <DataGraph
                                                        data={expandedTripData}
                                                        sensorIds={tripDetails.tripSensorIds}
                                                        doorSensorIds={tripDetails.tripDoorSensorIds}
                                                        sensorInfo={sensorInfo}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <h4 className="text-md font-semibold text-gray-800 mb-3">Trip Map</h4>
                                            <div className="h-80 bg-white rounded-lg shadow overflow-hidden">
                                                <TripMap positions={tripDetails.tripPositions} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};


export default DetailView;