import { useEffect, useMemo, useState } from "react";
import "./heatmap.css";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import React from "react";

function Heatmap({ onClose, points = [], onApply, onDownloadMap }) {
  const [mode, setMode] = useState("");   
  const [SDate, setSDate] = useState("");
  const [EDate, setEDate] = useState("");
  const [error, seterror] = useState("");
  const map = useMap();

  
  const safePoints = useMemo(() => {
    return (points || [])
      .map((p) => {
        const lat = Number(p[0]);
        const lng = Number(p[1]);
        const w = Number(p[2] ?? 1);

        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(w)) {
          return null;
        }
        return [lat, lng, w];
      })
      .filter(Boolean);
  }, [points]);


useEffect(() => {
  if (!safePoints.length) return;

  const maxW = Math.max(...safePoints.map(p => p[2] || 1));

  const heatLayer = L.heatLayer(safePoints, {
    radius: 40,
    blur: 25,
    max: maxW,     
    maxZoom: 17,
    gradient: {
      0.0: "rgba(255, 0, 0, 0.25)",
      0.2: "rgba(255, 0, 0, 0.45)",
      0.4: "rgba(255, 0, 0, 0.59)",
      0.6: "rgba(255, 0, 0, 0.72)",
      0.8: "rgba(255, 0, 0, 0.85)",
      1.0: "rgb(255, 0, 0)"
    }
  }).addTo(map);

  return () => map.removeLayer(heatLayer);
}, [safePoints, map]);



  const handleApply = () => {
    if (!mode){
      seterror("Please select an option (Home/Station/Combined).");
      return ;

    }
    if (!SDate || !EDate) {
      seterror("Please select Start Date and End Date.");
      return; 
    }


    if (EDate < SDate) {
      seterror("End Date cannot be before Start Date.");
      return; 
      
}
          


    onApply?.({
      mode,
      startDate: SDate,
      endDate: EDate,
    });
  };

  return (

    
    <div className="heatmap-panel">
      
      <div className="classification-font"> 
    Collection Heatmap
        </div>
      
      <button className="buttonHM" type="button" onClick={onClose}>
        ✕
      </button>

      <div className="heatmap-options">
        <label>Options</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">Select</option>
          <option value="home">Home pickup</option>
          <option value="station">Station pick up</option>
          <option value="combined">Home & Station</option>
          
        </select>
      </div>

       <div className="classification-font"> 
        Date Range
        </div>


         



      <div className="HM_date-range">
        <div className="Date-search">
            <div className="classification-font"> 
                From

          </div>
          <input
            type="date"
            className="input-field1"
            value={SDate}
            onChange={(e) => setSDate(e.target.value)}
          />
        </div>

        <div className="Date-search">
           <div className="classification-font"> 
                  To
              </div>



          <input
            type="date"
            className="input-field1"
            value={EDate}
            onChange={(e) => setEDate(e.target.value)}
            min={SDate}
          />
        </div>
      </div>

      <div className="button---apply">
        <button className="button-apply" type="button" onClick={handleApply}>
          Apply
        </button>
      </div>

          {error && <p className="error-text">{error}</p>}

    </div>
  );
}

export default Heatmap;
