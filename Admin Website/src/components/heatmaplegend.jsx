import React from "react";
function HeatmapLegend() {
  return (
    <div
      style={{
        position: "absolute",
        top: 90,
        right: 150,
        
        zIndex: 2000,
        background: "white",
        padding: "12px 14px",
        borderRadius: 10,
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        width: 190,
        fontFamily: "sans-serif"
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        UCO Collection Density
      </div>

      <div
        style={{
          height: 12,
          borderRadius: 6,
          background:
            "linear-gradient(to right,#ffe6e6,#ff9999,#ff4d4d,#b30000)",
          marginBottom: 6
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12
        }}
      >
        <span>Low</span>
        <span>High</span>
      </div>

      <div
        style={{
          fontSize: 14,
          color: "#666",
          marginTop: 6
        }}
      >
        Darker areas indicate higher collection activity
      </div>
    </div>
  );
}

export default HeatmapLegend;