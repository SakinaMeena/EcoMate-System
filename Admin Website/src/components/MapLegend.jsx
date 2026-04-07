import React from "react";

function MapLegend({ low, medium }) {

  const itemStyle = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 6
  };

  const dot = (color) => ({
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: color,
    border: "2px solid white",
    boxShadow: "0 0 6px rgba(0,0,0,0.25)",
  });

  return (
    <div
    
  style={{
    position: "absolute",
    bottom: 590,
    right: 30,
    zIndex: 2500,
    background: "white",
    padding: 12,
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    minWidth: 170,
  }}
>
  

      <div style={{ fontWeight: 800, marginBottom: 6 }}>
        Performance Legend
      </div>

      <div style={itemStyle}>
        <span style={dot("dodgerblue")} />
        <span>Not classified</span>
      </div>

      <div style={itemStyle}>
        <span style={dot("crimson")} />
        <span>Low (≤ {low})</span>
      </div>

      <div style={itemStyle}>
        <span style={dot("orange")} />
        <span>Medium ({low} – {medium})</span>
      </div>

      <div style={itemStyle}>
        <span style={dot("green")} />
        <span>High (&gt; {medium})</span>
      </div>

    </div>
  );
}

export default MapLegend;