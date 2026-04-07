
import React, { useEffect, useState,useMemo } from "react";
import "./GISPlatform.css";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, LayersControl, ZoomControl,GeoJSON,useMap  } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import ControlPanelButton from "../components/ControlPanelButton";
import SearchPanel from "../components/searchPanel";
import StationsMarkers from "../components/StationsMarkers";
import Heatmap from '../components/heatmap';
import supabase from "../supabaseClient";
import malaysia from "../data/malaysia.json";
import L from "leaflet";
import MapLegend from '../components/MapLegend';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import leafletImage from "leaflet-image";
import HeatmapLegend from "../components/heatmaplegend";




const { BaseLayer } = LayersControl;


//station movement
function MapStationZoomController({ selectedStation, stations }) {
 
  const map = useMap();

  useEffect(() => {
    if (!selectedStation) return;
    if (!stations || stations.length === 0) return;

    // Find station row by exact name 
    const station = stations.find((s) => s.name === selectedStation);
  

    if (!station) {

      console.warn("Station not found:", selectedStation);
      return;
    }

    const lat = Number(station.latitude);
    const lng = Number(station.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn("Invalid lat/lng for station:", station);
      return;
    }

    // fly to station point
    map.flyTo([lat, lng], 15, { duration: 1.2 });
  }, [selectedStation, stations, map]);

  return null;
}


//state movement
function MapZoomController({ selectedState, malaysiaGeoJson, stateNameMap }) {
  
  const map = useMap();

  useEffect(() => {
    if (!selectedState) return;

    const target = stateNameMap[selectedState] || selectedState; //array of state names

    const findFeature = (name) =>
      malaysiaGeoJson.features.find(
        (f) => (f?.properties?.name || "").toLowerCase() === name.toLowerCase()
      );

    // One state
    if (!Array.isArray(target)) {
      const feature = findFeature(target);
      if (!feature) return;

      const bounds = L.geoJSON(feature).getBounds();
      map.flyToBounds(bounds, {
  padding: [40, 40],
  duration: 1.5,
  maxZoom: 50,   
});
      return;
    }

    // Multiple states (KL+Selangor+Putrajaya)
    const layers = target
      .map((n) => findFeature(n))
      .filter(Boolean)
      .map((feature) => L.geoJSON(feature));

    if (!layers.length) return;

    const groupBounds = L.featureGroup(layers).getBounds();
    map.flyToBounds(groupBounds, { 
      padding: [40, 40],
      duration: 0.5,
      maxZoom: 40,   
    },);
  },
   [selectedState, malaysiaGeoJson, stateNameMap, map]);

  return null;
}



function classifyVolume(total, lowNum, mediumNum) {
  if (total <= lowNum) return "Low";
  if (total <= mediumNum) return "Medium";
  return "High";
}

function MapRefSetter({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}



function GIS(){

const [markerStations, setMarkerStations] = useState([]);
const navigate = useNavigate();
const [filterPayload, setFilterPayload] = useState(null);
const [activeView, setActiveView] = useState("");
const [stations, setStations] = useState([]);
const [selectedStation, setSelectedStation] = useState(null);
const [showResults, setShowResults] = useState(false);
const [error, setError] = useState("");
const [stateRows, setStateRows] = useState([]);
const [isControlOpen, setIsControlOpen] = useState(false);
const [isMinimized, setIsMinimized] = useState(false);
const [mapRef, setMapRef] = useState(null);



  // what SearchPanel sends for filtering markers (state + station)
  const [searchFilters, setSearchFilters] = useState({
    state: null,
    //stationName: null,
  });




// Load marker stations
useEffect(() => {
  const loadMarkerStations = async () => {
    const { data, error } = await supabase
      .from("stations_markers")
      .select("name, latitude, longitude"); 

     setError("");
    if (error) {
      console.error("Load markerStations error:", error);
      setError("issues loading page, try refresh the page");
      return;
    }

    setMarkerStations(data || []);
  };

  loadMarkerStations();
}, []);



  const STATE_NAME_MAP = useMemo(
    () => ({
      JOHOR: "Johor",
      KEDAH: "Kedah",
      KELANTAN: "Kelantan",
      MELAKA: "Melaka",
      PAHANG: "Pahang",
      PERAK: "Perak",
      PERLIS: "Perlis",
      "PULAU PINANG": "Pulau Pinang",
      SABAH: "Sabah",
      SARAWAK: "Sarawak",
      TERENGGANU: "Terengganu",
      "NEGERI SEMBILAN": "Negeri Sembilan",

      // special combined case
      KL_SELANGOR_PUTRAJAYA: ["Kuala Lumpur", "Selangor", "Putrajaya"],
    }),
    []
  );

  const normalizeState = (uiState) => {
  if (!uiState) return null;
  return STATE_NAME_MAP[uiState] || uiState;
};
 

// when user search for a state or station in search panel 
const handleStateApply = (stateValue, stationValue) => {
  console.log("STATE SEARCH clicked:", stateValue, stationValue);

  setSearchFilters({
    state: stateValue || null,
    stationName: stationValue?.trim() || null,
    
  });
   
if (stationValue) {
  const clean = stationValue.trim();
  setSelectedStation(null);
  setTimeout(() => setSelectedStation(clean), 0);
}

 // if (stateValue) zoomToState(stateValue, true);
};



// receive the  data from the search panel. 
 useEffect(() => {
  console.log("Received payload:", filterPayload);
  if (!filterPayload) return;

  const low = Number(filterPayload.lowNum);
  const medium = Number(filterPayload.mediumNum);
  const fetchData = async () => {

  if (!filterPayload.startDate || !filterPayload.endDate) {
      console.warn("Missing dates:", filterPayload);
      return;
    }

  const start_ts = new Date(filterPayload.startDate + "T00:00:00").toISOString();
  const endObj = new Date(filterPayload.endDate + "T00:00:00");
  endObj.setDate(endObj.getDate() + 1);
  const end_ts = endObj.toISOString();

    console.log("RPC params:", { start_ts, end_ts });

    //  MODE SWITCH

    if (filterPayload.mode === "state") {
      const mode = filterPayload.statemode || "both"; 

      const { data, error } = await supabase.rpc("stateclassification_spatial", {
        start_ts,
        end_ts,
        mode,
      });

      if (error) {
        console.error("State RPC error:", error);
        return;
      }

      //classfication of category 
      
      const classifiedStates = (data || []).map((row) => {
        const total = Number(row.total_volume || 0);
        return {
          ...row,
          category: classifyVolume(total, low, medium),
        };
      });


      setStateRows(classifiedStates);   
      console.log(" state row:", classifiedStates[0]);

      console.log("State rows returned:", classifiedStates.length);
      return;
    }

    
    const { data, error } = await supabase.rpc("classificationtable", { start_ts, end_ts });

    if (error) {
      console.error("RPC error:", error);
      error("fail to load data");
      return;
    }

    console.log("RAW DATA FROM SUPABASE:", data);

    const classified = (data || []).map((row) => {
      const total = Number(row.total_volume || 0);
      return {
        ...row,
        category: classifyVolume(total, low, medium),
      };
    });

    console.log("CLASSIFIED DATA:", classified);
    console.table(classified);

    setStations(classified);
    console.log("Rows returned:", classified.length);
    console.log("Keys in first row:", Object.keys(data?.[0] || {}));
  };

  fetchData();
}, [filterPayload]);



const thStyle = { textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" };
const tdStyle = { padding: 8, borderBottom: "1px solid #eee" };

// for showing the category of each station in the marker popups and results table

const categoryMap = useMemo(() => {
  const m = {};
  for (const r of stations) {
    m[r.station_id] = r.category;   
  }
  return m;
}, [stations]);

//state classification 





//heatmap 

const [showHeatmap, setShowHeatmap] = useState(false);
const [heatPoints, setHeatPoints] = useState([]);


const handleApplyHeatmap = async ({ mode, startDate, endDate }) => {
  let rpcName = null;

  if (mode === "station") rpcName = "heatmap_station";
  if (mode === "home") rpcName = "heatmap_home";
  if (mode ==="combined") rpcName ="heatmap_combine";
  

  if (!rpcName) return;

  // convert date string -> timestamptz range
  const start_ts = new Date(startDate + "T00:00:00").toISOString();

  const endObj = new Date(endDate + "T00:00:00");
  endObj.setDate(endObj.getDate() + 1); // include full endDate
  const end_ts = endObj.toISOString();

  const { data, error } = await supabase.rpc(rpcName, { start_ts, end_ts });

  if (error) {
    console.error("Heatmap RPC error:", error);
    return;
  }

  const formattedPoints = (data || [])
    .map((p) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      const weight = Number(p.weight);

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(weight)) return null;
      return [lat, lng, weight];
    })
    .filter(Boolean);

  setHeatPoints(formattedPoints);
};



//download the pdf 
const downloadResultsPDF = (customName, categories = ["all"]) => {

  const isStateMode = filterPayload?.mode === "state";
  const rows = isStateMode ? stateRows : stations;

  let filteredRows = rows;

  // Filter if not "all"
  if (!categories.includes("all")) {
    filteredRows = rows.filter((row) =>
      categories.includes(row.category?.toLowerCase())
    );
  }

  const doc = new jsPDF("p", "pt");

  doc.setFontSize(16);
  doc.text(`Results`, 40, 40);

  doc.setFontSize(11);

  doc.text(
    isStateMode
      ? `number of states: ${filteredRows.length}`
      : `number of stations: ${filteredRows.length}`,
    40,
    60
  );

  const startDate = filterPayload?.startDate;
  const endDate = filterPayload?.endDate;

  doc.text(
    startDate && endDate
      ? `Date range: ${startDate} to ${endDate}`
      : "Date range: All Dates",
    40,
    80
  );

  doc.text(
    categories.includes("all")
      ? "Category: All"
      : `Category: ${categories.join(", ")}`,
    40,
    100
  );

  const head = [
    isStateMode
      ? ["State", "Total volume collected", "Dropoff count", "Category"]
      : ["Station", "Total volume collected", "Dropoff amount", "Category"],
  ];

  const body = filteredRows.map((row) => [
    isStateMode ? (row.state ?? "") : (row.name ?? ""),
    Number(row.total_volume || 0).toFixed(2),
    String(row.dropoff_count ?? ""),
    row.category ?? "",
  ]);

  autoTable(doc, {
    startY: 120,
    head,
    body,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [0, 0, 0] },

    didParseCell: (data) => {
      if (data.section === "body") {

        const cat = String(body[data.row.index][3]).toLowerCase();

        if (cat === "low") data.cell.styles.fillColor = [255, 220, 220];
        if (cat === "medium") data.cell.styles.fillColor = [255, 245, 200];
        if (cat === "high") data.cell.styles.fillColor = [220, 255, 220];

      }
    },
  });

  const safeName =
    (customName || "Results")
      .replace(/[\\/:*?"<>|]/g, "")
      .trim() || "Results";

  doc.save(`${safeName}.pdf`);
};





//state classification
const stateByName = useMemo(() => {
  const m = {};
  for (const r of stateRows || []) {
    m[r.state] = r; // { state, total_volume, dropoff_count, category }
  }
  return m;
}, [stateRows]);

const getStateFill = (cat) => {
  if (cat === "Low") return "#e74c3c";     
  if (cat === "Medium") return "#f1c40f";  
  if (cat === "High") return "#2ecc71";    
  return "#999"; 
};

const styleStates = (feature) => {
  const name = feature?.properties?.name;   
  const row = name ? stateByName[name] : null;
    if (name && !row) console.log("No match for:", name);

  return {
    weight: 1,
    color: "#555",
    fillColor: getStateFill(row?.category),
    fillOpacity: row ? 0.55 : 0.10, 
  };
};






const isStateMode = filterPayload?.mode === "state";
const resultsRows = isStateMode ? stateRows : stations;

//for closing search panel
const closeSearchAndReset = () => {
  setActiveView(null);

 
  setShowResults(false);

  
  setFilterPayload(null);
  setStations([]);
  setStateRows([]);

  
  setSelectedStation(null);
  setSearchFilters({ state: null, stationName: null });

  
  setHeatPoints([]);
  setShowHeatmap(false);

 
  setError("");
};


const downloadMapPNG = () => {
  console.log("DOWNLOAD clicked. mapRef:", mapRef);

  if (!mapRef) {
    alert("Map not ready yet");
    return;
  }

  leafletImage(mapRef, (err, canvas) => {
    console.log("leafletImage callback:", { err, canvas });

    if (err) {
      console.error("leafletImage error:", err);
      alert("Export failed (tiles may block capture).");
      return;
    }

    const img = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = img;
    a.download = "heatmap.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
};


  return (
  
  <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      
      
      
     
      <MapContainer
        center={[3.139, 101.6869]} 
        zoom={11}
        zoomControl={false} 
        style={{ height: "100%", width: "100%" }}
      
      >

       
      
      <ZoomControl position="bottomright" />
      <LayersControl position="topright">
          
          
      <BaseLayer checked name="OpenStreetMap">
      <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      </BaseLayer>

         { /*  Carto Light (nice clean admin-dashboard look) */}
      <BaseLayer name="Carto Light">
      <TileLayer
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      </BaseLayer>

            Carto Dark (dark mode) 
            
      <BaseLayer name="Carto Dark">
      <TileLayer
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      </BaseLayer>

       
      <BaseLayer name="Satellite (Esri)">
      <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      </BaseLayer>

       Esri Topographic 
      <BaseLayer name="Topo (Esri)">
      <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
      />
      </BaseLayer>

     
      </LayersControl>

<MapZoomController
    selectedState={searchFilters.state}
    malaysiaGeoJson={malaysia}
    stateNameMap={STATE_NAME_MAP}
    
  />

  {filterPayload?.mode === "state" && (
  <GeoJSON
    data={malaysia}
    style={styleStates}
  />
)}
        {filterPayload?.mode !== "state" && activeView !== "heatmap" && (
  <StationsMarkers
    filters={searchFilters}
    categoryMap={categoryMap}
  />
)}

 <MapStationZoomController
        selectedStation={selectedStation}
        stations={markerStations}
      />
{showHeatmap && (
  <Heatmap
    points={heatPoints}
    onClose={() => setShowHeatmap(false)}
    onApply={handleApplyHeatmap}
    onDownloadMap={downloadMapPNG}

  />
)}

{activeView === "heatmap" && (
  <>
    <Heatmap
      points={heatPoints}
      onClose={() => setActiveView(null)}
      onApply={handleApplyHeatmap}
    />

    <HeatmapLegend />
  </>
)}


<MapRefSetter onReady={setMapRef} />

      </MapContainer>

{activeView === "search" && filterPayload &&

<MapLegend 
  low={filterPayload?.lowNum}
  medium={filterPayload?.mediumNum}
/>}

  <ControlPanelButton
    activeView={activeView}
    setActiveView={setActiveView}
    isControlOpen={isControlOpen}
    setIsControlOpen={setIsControlOpen}
    isMinimized={isMinimized}
    setIsMinimized={setIsMinimized}
  />

{isMinimized && (
  <div className="minimized-pill">
    <button
      type="button"
      onClick={() => setIsMinimized(false)}
      className="minimized-pill-btn"
    >
      ▲ Control Panel
    </button>
  </div>
)}





{activeView === "search" && (
  <SearchPanel
  onClose={closeSearchAndReset}
  onApply={(payload) => setFilterPayload(payload)}     // classification apply
  stateApply={handleStateApply}  //state movement 
  
  onReset={() => {
  setFilterPayload(null);
  setStations([]);   
}}


showResults={showResults}
  setShowResults={setShowResults}
 //reset button


  onDownloadPDF={downloadResultsPDF}
/>
)}


{showResults && (
<div
  style={{
    position: "absolute",
    right: 20,
    bottom: 20,
    zIndex: 2000,
    width: 420,
    maxHeight: 320,
    overflow: "auto",
    background: "white",
    borderRadius: 12,
    padding: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  }}
>
  <h3 style={{ margin: "0 0 10px 0" }}>Results</h3>
 <p style={{ margin: "0 0 10px 0" }}>
  Rows: {resultsRows.length} </p>


  {resultsRows.length === 0 ? (
    <p style={{ margin: 0 }}>No data yet. Click Apply.</p>
  ) : (

    
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
  <thead>
    <tr>
      {isStateMode ? (
        <>
          <th style={thStyle}>State</th>
          <th style={thStyle}>Total volume collected</th>
          <th style={thStyle}>Dropoff count</th>
          <th style={thStyle}>Category</th>
        </>
      ) : (
        <>
          <th style={thStyle}>Station</th>
          <th style={thStyle}>Total volume collected</th>
          <th style={thStyle}>Drops off amount</th>
          <th style={thStyle}>Category</th>
        </>
      )}
    </tr>
  </thead>

  <tbody>
    {resultsRows.map((row) => (
      <tr
        key={isStateMode ? row.state : row.station_id}
        className={`result-row cat-${String(row.category || "").toLowerCase()}`}
      >
        <td style={tdStyle}>{isStateMode ? row.state : row.name}</td>
        <td style={tdStyle}>{Number(row.total_volume || 0).toFixed(2)}</td>
        <td style={tdStyle}>{row.dropoff_count}</td>
        <td style={tdStyle}>{row.category}</td>
      </tr>
    ))}
  </tbody>
</table>


  )}
</div>
)}

</div>

); 

}
export default GIS;


