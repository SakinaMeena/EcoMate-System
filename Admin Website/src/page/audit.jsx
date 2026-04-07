import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from "../supabaseClient";

function Audit() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState([]);
  const [filteredBlocks, setFilteredBlocks] = useState([]);
  const [totalVolume, setTotalVolume] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chainStatus, setChainStatus] = useState(null);
  const [flaggedIndexes, setFlaggedIndexes] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState('index');
  const [sortDirection, setSortDirection] = useState('desc');
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [stationCodeMap, setStationCodeMap] = useState({});

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const { data: blocksData, error: blocksError } = await supabase
        .from('blockchain_ledger')
        .select('index, timestamp, payload, user_id_hashed, previous_hmac, current_hmac')
        .order('index', { ascending: false })
        .limit(100);

      if (blocksError) throw blocksError;

      let enriched = [];
      if (blocksData?.length > 0) {
        enriched = await Promise.all(
          blocksData.map(async (block) => {
            const { data: refs } = await supabase
              .from('ledger_references')
              .select('event_type, dropoff_id, station_id, user_id, confirmation_token')
              .eq('ledger_index', String(block.index))
              .limit(1);

            const ref = refs?.[0] || {};

            let drop = {};
            if (ref.dropoff_id) {
              const { data: dropData } = await supabase
                .from('dropoffs')
                .select('collector_id, user_id, station_id, location, estimated_volume, actual_volume, status, dropoff_type, user_address, collected_at, batch_id')
                .eq('dropoff_id', ref.dropoff_id)
                .single();
              drop = dropData || {};
            }

            let station = {};
            const stationId = ref.station_id || drop.station_id;
            if (stationId) {
              const { data: stationData } = await supabase
                .from('stations')
                .select('name, address, station_operator_id, station_code')
                .eq('station_id', stationId)
                .single();
              station = stationData || {};
              station.station_id = stationId;
            }

            let batch = {};
            const batchId = drop.batch_id || block.payload?.batch_id;
            if (batchId) {
              const { data: batchData } = await supabase
                .from('batches')
                .select('total_volume, status, depot_id, created_by')
                .eq('batch_id', batchId)
                .single();
              batch = batchData || {};
            }

            let payloadObj = block.payload;
            if (typeof payloadObj === 'string') {
              try {
                payloadObj = JSON.parse(payloadObj);
              } catch (parseError) {
                console.error('Failed to parse payload for index', block.index, parseError);
                payloadObj = {};
              }
            }

            const actorEmail = payloadObj?.actor_email || '-';
            const depotId = payloadObj?.depot_id || batch.depot_id || '-';

            return {
              ...block,
              ref,
              drop,
              station,
              batch,
              actor_email: actorEmail,
              depot_id: depotId,
              parsed_payload: payloadObj,
            };
          })
        );
      }

      const codeMap = {};
      let counter = 1;
      enriched.forEach((block) => {
        const sid = block.station?.station_id;
        if (sid && !codeMap[sid]) {
          if (block.station?.station_code) {
            codeMap[sid] = block.station.station_code;
          } else {
            codeMap[sid] = `Station ${String(counter).padStart(2, '0')}`;
            counter++;
          }
        }
      });
      setStationCodeMap(codeMap);

      setBlocks(enriched);
      setFilteredBlocks(enriched);

      const { data: deliveredBatches, error: batchErr } = await supabase
        .from('batches')
        .select('total_volume')
        .eq('status', 'delivered');

      if (batchErr) throw batchErr;

      const total = deliveredBatches.reduce((sum, b) => sum + Number(b.total_volume || 0), 0).toFixed(2);
      setTotalVolume(total);
    } catch (err) {
      setError(err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetVerification = () => setChainStatus(null);

  const verifyChain = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-chain', { method: 'GET' });
      if (error) throw error;

      if (!data.isValid && data.brokenAt !== null) {
        if (flaggedIndexes.has(data.brokenAt)) {
          // Already notified admin about this index — show as clean
          setChainStatus({ ...data, alreadyFlagged: true });
        } else {
          // New tamper — add to flagged set and alert
          setFlaggedIndexes(prev => new Set(prev).add(data.brokenAt));
          setChainStatus({ ...data, alreadyFlagged: false });
        }
      } else {
        setChainStatus(data);
      }
    } catch (err) {
      console.error('Verify chain error:', err);
      setChainStatus({ isValid: false, message: 'Verification failed' });
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, []);

  useEffect(() => {
    applyDateFilter();
  }, [dateRange, customStartDate, customEndDate, blocks]);

  const applyDateFilter = () => {
    if (dateRange === 'all') {
      setFilteredBlocks(blocks);
      setCurrentPage(1);
      return;
    }

    const now = new Date();
    let startDate;
    if (dateRange === '7days') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (dateRange === '30days') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (dateRange === 'custom' && customStartDate) startDate = new Date(customStartDate);

    const endDate = dateRange === 'custom' && customEndDate ? new Date(customEndDate) : now;

    const filtered = blocks.filter(block => {
      const blockDate = new Date(block.drop?.collected_at || block.timestamp);
      return (!startDate || blockDate >= startDate) && blockDate <= endDate;
    });

    setFilteredBlocks(filtered);
    setCurrentPage(1);
  };

  const handleSort = (column) => {
    const direction = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(direction);

    const sorted = [...filteredBlocks].sort((a, b) => {
      let aVal, bVal;
      switch (column) {
        case 'index':
          aVal = a.index; bVal = b.index; break;
        case 'timestamp':
          aVal = new Date(a.drop?.collected_at || a.timestamp);
          bVal = new Date(b.drop?.collected_at || b.timestamp);
          break;
        case 'volume':
          aVal = (a.drop?.status === 'reached_depot' || a.batch?.status === 'delivered')
            ? Number(a.drop?.actual_volume ?? a.drop?.estimated_volume ?? a.batch?.total_volume ?? a.parsed_payload?.total_volume ?? 0) : 0;
          bVal = (b.drop?.status === 'reached_depot' || b.batch?.status === 'delivered')
            ? Number(b.drop?.actual_volume ?? b.drop?.estimated_volume ?? b.batch?.total_volume ?? b.parsed_payload?.total_volume ?? 0) : 0;
          break;
        case 'status':
          aVal = a.drop?.status || a.batch?.status || a.parsed_payload?.event_type || a.parsed_payload?.status || '';
          bVal = b.drop?.status || b.batch?.status || b.parsed_payload?.event_type || b.parsed_payload?.status || '';
          break;
        case 'station':
          aVal = a.station?.name || ''; bVal = b.station?.name || ''; break;
        case 'actor_email':
          aVal = a.actor_email || ''; bVal = b.actor_email || ''; break;
        case 'depot_id':
          aVal = a.depot_id || ''; bVal = b.depot_id || ''; break;
        default:
          return 0;
      }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredBlocks(sorted);
  };

  const getEventType = (drop, ref, parsedPayload) => {
    const type = (drop?.dropoff_type || ref?.event_type || parsedPayload?.event_type || parsedPayload?.dropoff_type || '').toLowerCase();
    if (type.includes('self_delivery') || type.includes('self') || type === 'station_dropoff' || type.includes('station')) return 'Station Dropoff';
    if (type.includes('home_pickup') || type.includes('pickup') || type.includes('home')) return 'Home Pickup';
    if (type.includes('bulk_departure')) return 'Bulk Departure';
    if (type.includes('depot_arrival')) return 'Depot Arrival';
    return type || 'Unknown';
  };

  const partialId = (id) => (id ? `${id.substring(0, 8)}…` : '-');

  const COLLECTED_STATUSES = ['collected', 'self_delivery_confirmed', 'station_dropoff', 'pickup', 'home_pickup'];
  const OUT_STATUSES = ['sent_to_depot', 'bulk_departure', 'transit_to_depot', 'in_transit_to_depot'];
  const REACHED_STATUSES = ['reached_depot', 'depot_arrival', 'delivered'];

  const normaliseStatus = (raw) => {
    const val = (raw || '').toLowerCase();
    if (COLLECTED_STATUSES.includes(val)) return 'Collected';
    if (OUT_STATUSES.includes(val)) return 'Out';
    if (REACHED_STATUSES.includes(val)) return 'Reached';
    if (val === 'pending') return 'Pending';
    return 'Unknown';
  };

  const getRawStatus = (block) =>
    block.drop?.status || block.batch?.status || block.parsed_payload?.event_type || block.parsed_payload?.status || '';

  const collectedCount = filteredBlocks.filter(b => normaliseStatus(getRawStatus(b)) === 'Collected').length;
  const pendingCount = filteredBlocks.filter(b => normaliseStatus(getRawStatus(b)) === 'Pending').length;

  const handleItemsPerPageChange = (newVal) => {
    setItemsPerPage(newVal);
    setCurrentPage(1);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBlocks = filteredBlocks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBlocks.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return <span className="ml-1 text-gray-400">↕</span>;
    return sortDirection === 'asc' ? <span className="ml-1 text-white">↑</span> : <span className="ml-1 text-white">↓</span>;
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f2f5f0' }}>
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold" style={{ color: '#245B43' }}>Audit & Traceability</h1>
            <p className="mt-2 text-lg" style={{ color: '#245B43' }}>
              Immutable collection events • {filteredBlocks.length} records {dateRange !== 'all' ? 'filtered' : 'loaded'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={fetchBlocks}
              disabled={loading}
              className="px-8 py-3 font-medium text-blue-600 bg-transparent border-2 border-blue-600 hover:bg-blue-50 active:bg-blue-100 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={verifyChain}
              disabled={loading}
              className="px-8 py-3 font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg shadow-md transition-all border-2 border-emerald-700"
            >
              {loading ? 'Checking...' : 'Verify Tamper'}
            </button>
            {chainStatus && (
              <button
                onClick={resetVerification}
                className="px-8 py-3 font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg shadow-md transition-all"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* CHAIN STATUS */}
        {chainStatus && (
          <div className={`mb-8 p-6 rounded-xl border text-center font-medium text-lg shadow-sm ${
            chainStatus.isValid || chainStatus.alreadyFlagged
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {chainStatus.isValid ? (
              <span>No Unauthorised Changes Made — {chainStatus.totalBlocks || '?'} blocks verified</span>
            ) : chainStatus.alreadyFlagged ? (
              <span>
                No Unauthorised Changes Made
                <span className="block mt-2 text-sm text-amber-700">
                  Note: Block {chainStatus.brokenAt} was previously flagged and the administrator has been notified
                </span>
              </span>
            ) : (
              <span>
                Tampering detected at block {chainStatus.brokenAt || 'unknown'} — administrator has been notified
                {chainStatus.brokenReason && <span className="block mt-2 text-sm">{chainStatus.brokenReason}</span>}
              </span>
            )}
          </div>
        )}

        {/* DATE FILTER */}
        <div className="mb-6 bg-white p-6 rounded-xl border border-gray-200 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <label className="text-sm font-medium" style={{ color: '#245B43' }}>Filter by Date:</label>
            <div className="flex flex-wrap gap-2">
              {['all', '7days', '30days', 'custom'].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${dateRange === range ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {range === 'all' ? 'All Time' : range === '7days' ? 'Last 7 Days' : range === '30days' ? 'Last 30 Days' : 'Custom Range'}
                </button>
              ))}
            </div>
            {dateRange === 'custom' && (
              <div className="flex gap-2 items-center">
                <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                <span className="text-gray-500">to</span>
                <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            )}
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
            <p className="text-sm font-medium" style={{ color: '#245B43' }}>Total Records</p>
            <p className="text-5xl font-bold text-gray-900 mt-2">{filteredBlocks.length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
            <p className="text-sm font-medium" style={{ color: '#245B43' }}>Collected</p>
            <p className="text-5xl font-bold text-emerald-700 mt-2">{collectedCount}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
            <p className="text-sm font-medium" style={{ color: '#245B43' }}>Pending</p>
            <p className="text-5xl font-bold text-amber-600 mt-2">{pendingCount}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
            <p className="text-sm font-medium" style={{ color: '#245B43' }}>Reached Depot Volume</p>
            <p className="text-5xl font-bold text-blue-600 mt-2">{totalVolume} L</p>
            <p className="text-xs text-gray-500 mt-1">Sum of delivered batches only</p>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-24 text-center text-gray-500 text-xl">Loading records...</div>
          ) : error ? (
            <div className="p-12 text-center text-red-700 text-xl">Error loading records: {error}</div>
          ) : filteredBlocks.length === 0 ? (
            <div className="py-24 text-center text-gray-500 text-xl">No records found for selected date range.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="max-h-[70vh] overflow-y-auto">
                  <table className="w-full table-fixed divide-y divide-gray-200">
                    <colgroup><col style={{width:'60px'}}/><col style={{width:'150px'}}/><col style={{width:'130px'}}/><col style={{width:'90px'}}/><col style={{width:'100px'}}/><col style={{width:'110px'}}/><col style={{width:'120px'}}/><col style={{width:'110px'}}/><col style={{width:'160px'}}/><col style={{width:'120px'}}/></colgroup>
                    <thead className="bg-gray-900 sticky top-0">
                      <tr>
                        <th onClick={() => handleSort('index')} className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-gray-800 whitespace-nowrap align-middle">
                          <span className="flex items-center gap-1">Index <SortIcon column="index" /></span>
                        </th>
                        <th onClick={() => handleSort('timestamp')} className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-gray-800 whitespace-nowrap align-middle">
                          <span className="flex items-center gap-1">Date & Time <SortIcon column="timestamp" /></span>
                        </th>
                        <th className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap align-middle">
                          Activity
                        </th>
                        <th onClick={() => handleSort('volume')} className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-gray-800 whitespace-nowrap align-middle">
                          <span className="flex items-center gap-1">Vol (L) <SortIcon column="volume" /></span>
                        </th>
                        <th onClick={() => handleSort('status')} className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-gray-800 whitespace-nowrap align-middle">
                          <span className="flex items-center gap-1">Status <SortIcon column="status" /></span>
                        </th>
                        <th onClick={() => handleSort('station')} className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-gray-800 whitespace-nowrap align-middle">
                          <span className="flex items-center gap-1">Station <SortIcon column="station" /></span>
                        </th>
                        <th className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap align-middle">
                          Collector ID
                        </th>
                        <th className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap align-middle">
                          User ID
                        </th>
                        <th onClick={() => handleSort('actor_email')} className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-gray-800 whitespace-nowrap align-middle">
                          <span className="flex items-center gap-1">Email <SortIcon column="actor_email" /></span>
                        </th>
                        <th onClick={() => handleSort('depot_id')} className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-gray-800 whitespace-nowrap align-middle">
                          <span className="flex items-center gap-1">Depot ID <SortIcon column="depot_id" /></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {currentBlocks.map((block, idx) => {
                        const ref = block.ref || {};
                        const drop = block.drop || {};
                        const station = block.station || {};
                        const batch = block.batch || {};
                        const eventType = getEventType(drop, ref, block.parsed_payload);

                        const volume =
                          normaliseStatus(getRawStatus(block)) === 'Reached'
                            ? (drop.actual_volume ?? drop.estimated_volume ?? batch.total_volume ?? block.parsed_payload?.total_volume ?? '-')
                            : '-';

                        const statusText = normaliseStatus(getRawStatus(block));

                        const statusColor =
                          statusText === 'Collected' ? 'text-emerald-700 font-bold' :
                          statusText === 'Out'       ? 'text-orange-600 font-bold' :
                          statusText === 'Reached'   ? 'text-blue-600 font-bold' :
                          statusText === 'Pending'   ? 'text-amber-600 font-bold' :
                          'text-gray-500 font-bold';

                        const rowBg =
                          statusText === 'Collected' ? 'bg-emerald-50 hover:bg-emerald-100' :
                          statusText === 'Out'       ? 'bg-orange-50 hover:bg-orange-100' :
                          statusText === 'Reached'   ? 'bg-blue-50 hover:bg-blue-100' :
                          statusText === 'Pending'   ? 'bg-amber-50 hover:bg-amber-100' :
                          idx % 2 === 0 ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-gray-50';

                        const stationUuid = station.station_id || ref.station_id || drop.station_id;
                        const stationShortCode = stationUuid ? (stationCodeMap[stationUuid] || 'Station —') : '-';
                        const stationName = station.name || '-';

                        // Inline email truncation
                        const displayEmail = block.actor_email.length > 20
                          ? block.actor_email.substring(0, 17) + '...'
                          : block.actor_email;

                        return (
                          <tr key={block.index} className={`transition-colors duration-200 ${rowBg}`}>
                            <td className="px-4 py-5 text-sm font-medium text-gray-900">{block.index}</td>
                            <td className="px-4 py-5 text-sm text-gray-700 font-mono">
                              {(drop.collected_at || block.timestamp).split('.')[0].replace('T', ' ')}
                            </td>
                            <td className="px-4 py-5 text-sm text-gray-900 font-medium">{eventType}</td>
                            <td className="px-4 py-5 text-sm text-gray-900 font-medium">{volume}</td>
                            <td className={`px-4 py-5 text-sm ${statusColor}`}>{statusText}</td>

                            {/* Station */}
                            <td className="px-4 py-5 text-sm text-gray-800 group relative">
                              <span className="cursor-help font-medium">{stationShortCode}</span>
                              {stationUuid && (
                                <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl z-20 w-64 left-0 top-full mt-1">
                                  <p className="font-semibold text-gray-200 mb-1">Station Details</p>
                                  <p><span className="text-gray-400">Name: </span>{stationName}</p>
                                  <p className="mt-1 break-all"><span className="text-gray-400">ID: </span>{stationUuid}</p>
                                </div>
                              )}
                            </td>

                            {/* Collector ID */}
                            <td className="px-4 py-5 text-sm text-gray-600 font-mono group relative">
                              <span className="cursor-help">{partialId(drop.collector_id || batch.created_by || null)}</span>
                              <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded p-3 shadow-xl z-20 w-max max-w-xs break-all left-0 top-full mt-1">
                                {drop.collector_id || batch.created_by || '-'}
                              </div>
                            </td>

                            {/* User ID */}
                            <td className="px-4 py-5 text-sm text-gray-600 font-mono group relative">
                              <span className="cursor-help">{partialId(drop.user_id || ref.user_id || null)}</span>
                              <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded p-3 shadow-xl z-20 w-max max-w-xs break-all left-0 top-full mt-1">
                                {drop.user_id || ref.user_id || '-'}
                              </div>
                            </td>

                            {/* Email */}
                            <td className="px-4 py-5 text-sm text-gray-600 font-mono group relative">
                              <span className="cursor-help truncate block max-w-full">{displayEmail}</span>
                              <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded p-3 shadow-xl z-20 w-max max-w-lg break-all left-0 top-full mt-1">
                                {block.actor_email}
                              </div>
                            </td>

                            {/* Depot ID */}
                            <td className="px-4 py-5 text-sm text-gray-600 font-mono group relative">
                              <span className="cursor-help truncate block max-w-full">
                                {block.depot_id !== '-' ? partialId(block.depot_id) : '-'}
                              </span>
                              <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded p-3 shadow-xl z-20 w-max max-w-xs break-all left-0 top-full mt-1">
                                {block.depot_id}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PAGINATION + ROWS PER PAGE */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">
                    Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(indexOfLastItem, filteredBlocks.length)}</span> of{' '}
                    <span className="font-medium">{filteredBlocks.length}</span> results
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Rows:</span>
                    {[5, 10, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => handleItemsPerPageChange(n)}
                        className={`px-3 py-1 text-sm font-medium rounded-lg transition-all ${
                          itemsPerPage === n
                            ? 'bg-gray-800 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Previous
                    </button>
                    {getPageNumbers().map((page, index) => (
                      page === '...' ? (
                        <span key={`ellipsis-${index}`} className="px-4 py-2 text-gray-500">...</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => paginate(page)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                            currentPage === page ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    ))}
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Audit;