
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthCredentials, Vehicle, HistoricalDataPoint } from '../types';
import WebfleetService from '../services/webfleetService';
import DataGraph from './DataGraph';
import { IconDownload, IconTicket, IconDocumentReport } from '../constants';

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
  const [isGeneratingTicket, setIsGeneratingTicket] = useState(false);
  const [isGeneratingDoorReport, setIsGeneratingDoorReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sensorIds, sensorInfo, doorSensorIds } = useMemo(() => {
    const tempIds = new Set<string>();
    const tempInfo = new Map<string, string>();
    const doorIds = new Set<string>();

    // Scan all data points to find every sensor that has at least one record.
    data.forEach(point => {
        if (point.temperatures) {
            for (const id in point.temperatures) {
                // Check hasOwnProperty to be safe, though keys from API should be fine.
                if (Object.prototype.hasOwnProperty.call(point.temperatures, id)) {
                    if (!tempIds.has(id)) {
                        tempIds.add(id);
                        tempInfo.set(id, point.temperatures[parseInt(id, 10)].name);
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
        sensorIds: Array.from(tempIds).sort((a,b) => parseInt(a) - parseInt(b)),
        sensorInfo: tempInfo,
        doorSensorIds: Array.from(doorIds).sort((a,b) => parseInt(a) - parseInt(b)),
    };
  }, [data]);
  
  useEffect(() => {
    if (!isLoading && data.length > 0) {
        const tempSensorCounts: { [id: string]: number } = {};
        const doorSensorCounts: { [id: string]: number } = {};

        data.forEach(point => {
            if (point.temperatures) {
                Object.keys(point.temperatures).forEach(id => {
                    tempSensorCounts[id] = (tempSensorCounts[id] || 0) + 1;
                });
            }
            if (point.doorStatus) {
                Object.keys(point.doorStatus).forEach(id => {
                    doorSensorCounts[id] = (doorSensorCounts[id] || 0) + 1;
                });
            }
        });
        
        const tempSensorIdsFound = Object.keys(tempSensorCounts).sort((a, b) => parseInt(a) - parseInt(b));
        const doorSensorIdsFound = Object.keys(doorSensorCounts).sort((a, b) => parseInt(a) - parseInt(b));

        console.log(`[Detail View] Data analysis for range "${rangeOptions.find(o => o.value === rangePattern)?.label}":`);

        if (tempSensorIdsFound.length > 0) {
            console.log(`Found ${tempSensorIdsFound.length} temperature sensor(s) with data.`);
            tempSensorIdsFound.forEach(id => {
                const name = sensorInfo.get(id) || `Sensor ${id}`;
                console.log(`  - Sensor '${name}' (ID: ${id}): ${tempSensorCounts[id]} records`);
            });
        } else {
            console.log("No temperature sensor data found for this period.");
        }

        if (doorSensorIdsFound.length > 0) {
            console.log(`Found ${doorSensorIdsFound.length} door sensor(s) with data.`);
            doorSensorIdsFound.forEach(id => {
                console.log(`  - Door Sensor (ID: ${id}): ${doorSensorCounts[id]} records`);
            });
        } else {
            console.log("No door sensor data found for this period.");
        }
    } else if (!isLoading) {
        console.log(`[Detail View] No historical data found for range "${rangeOptions.find(o => o.value === rangePattern)?.label}".`);
    }
  }, [data, sensorInfo, rangePattern, isLoading]);

  const doorEvents = useMemo(() => {
    if (!data || data.length === 0) return [];

    const events: HistoricalDataPoint[] = [];
    let lastKnownStatuses: { [id: number]: 0 | 1 } | null = null;

    for (const point of data) {
        const currentStatuses = point.doorStatus;
        if (currentStatuses && Object.keys(currentStatuses).length > 0) {
            const hasChanged = !lastKnownStatuses || 
                Object.keys(currentStatuses).some(id => currentStatuses[parseInt(id)] !== lastKnownStatuses?.[parseInt(id)]) ||
                Object.keys(lastKnownStatuses || {}).length !== Object.keys(currentStatuses).length;

            if (hasChanged) {
                events.push(point);
                lastKnownStatuses = { ...(lastKnownStatuses || {}), ...currentStatuses };
            }
        } else if (lastKnownStatuses) { // from having status to not having it
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
                const status = item.doorStatus?.[parseInt(id, 10)];
                row.push(status === 1 ? 'Open' : (status === 0 ? 'Closed' : 'N/A'));
            });
            if (hasTemperatureData) {
                sensorIds.forEach(id => {
                    const temp = item.temperatures?.[parseInt(id, 10)];
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
        
        const ticketSensorIds = Array.from(ticketSensorInfo.keys()).sort((a,b)=> parseInt(a)-parseInt(b));

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
                const temp = point.temperatures?.[parseInt(id, 10)];
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
                // Header
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
                
                // Footer
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
                        const temp = item.temperatures?.[parseInt(id, 10)];
                        row.push(typeof temp?.value === 'number' ? temp.value.toFixed(1) : 'N/A');
                    });
                }
                if (hasDoorStatusData) {
                    doorSensorIds.forEach(id => {
                        const status = item.doorStatus?.[parseInt(id, 10)];
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
                    onClick={handleGenerateThermographTicket}
                    disabled={isGeneratingTicket || isLoading || !hasTemperatureData}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    aria-label="Generate Thermograph Ticket"
                >
                    {isGeneratingTicket ? <PdfSpinner/> : <IconTicket className="h-5 w-5" />}
                    {isGeneratingTicket ? 'Generating...' : 'Thermograph Report'}
                </button>
                <button
                    onClick={handleGenerateDoorReport}
                    disabled={isGeneratingDoorReport || isLoading || !hasDoorStatusData}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    aria-label="Generate Door Status Report"
                >
                    {isGeneratingDoorReport ? <PdfSpinner/> : <IconDocumentReport className="h-5 w-5" />}
                    {isGeneratingDoorReport ? 'Generating...' : 'Door Report'}
                </button>
                <button
                    onClick={handleDownloadPdf}
                    disabled={isDownloading || isLoading || data.length === 0}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    aria-label="Download Full Report as PDF"
                >
                    {isDownloading ? <PdfSpinner/> : <IconDownload className="h-5 w-5" />}
                    {isDownloading ? 'Generating...' : 'Download PDF'}
                </button>
            </div>
          </div>
           {error && <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-md">{error}</p>}
          <div id="datagraph-container" className="h-96">
            {isLoading ? <Spinner /> : <DataGraph data={data} sensorIds={sensorIds} doorSensorIds={doorSensorIds} sensorInfo={sensorInfo} />}
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
                      <tr key={`${point.timestamp}-${index}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(point.timestamp).toLocaleString()}
                        </td>
                        {hasTemperatureData && sensorIds.map(id => (
                            <td key={`temp-td-${id}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {point.temperatures?.[parseInt(id, 10)] != null 
                                    ? `${point.temperatures[parseInt(id, 10)].value.toFixed(1)}` 
                                    : 'N/A'
                                }
                            </td>
                        ))}
                        {hasDoorStatusData && doorSensorIds.map(id => (
                          <td key={`door-td-${id}`} className="px-6 py-4 whitespace-nowrap text-sm">
                              {
                                  (() => {
                                      const status = point.doorStatus?.[parseInt(id, 10)];
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
        </div>
      </div>
    </div>
  );
};

export default DetailView;
