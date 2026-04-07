import React, { useEffect, useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import supabase from "../supabaseClient";
import L from "leaflet";
import "./stationmarker.css";

import lowIconImg from "../assets/markers/marker-low.png";
import mediumIconImg from "../assets/markers/marker-medium.png";
import highIconImg from "../assets/markers/marker-high.png";
import blueIconImg from "../assets/markers/marker-blue.png";



const lowIcon = new L.Icon({
  iconUrl: lowIconImg,
  iconSize: [85, 80],
  iconAnchor: [30, 40],
  popupAnchor: [0, -60],

});

const mediumIcon = new L.Icon({
  iconUrl: mediumIconImg,
  iconSize: [85, 80],
  iconAnchor: [30, 40],
  popupAnchor: [0, -60],

});

const highIcon = new L.Icon({
  iconUrl: highIconImg,
 iconSize: [85, 80],
  iconAnchor: [30, 40],
  popupAnchor: [0, -60],

});


const blueIcon = new L.Icon({
  iconUrl: blueIconImg,
  iconSize: [85, 80],
  iconAnchor: [30, 40],
  popupAnchor: [0, -60],
});


function StationsMarkers({  categoryMap }) {
  const map = useMap();
  const [stations, setStations] = useState([]);

  useEffect(() => {
    const loadStations = async () => {
      const { data, error } = await supabase
      .from("stations_markers")
      .select("*");
      if (error) {
        console.error("Supabase error:", error);
        return;
      }
      setStations(data || []);
    };

    loadStations();
  }, []);

  return (
    <>
      {stations.map((s) => {
        const lat = Number(s.latitude);
        const lng = Number(s.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

       const category = categoryMap?.[s.station_id];

        const icon =
          category === "Low"
            ? lowIcon
            : category === "Medium"
            ? mediumIcon
            : category === "High"
            ? highIcon
            : blueIcon;

        return (
          <Marker key={s.station_id} position={[lat, lng]} icon={icon}>
            <Popup>
              <strong>{s.name}</strong>
              <br />
              State: {s.state}
              <br />
              Current level: {s.current_level_litres ?? "N/A"}
              <br />
             
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default StationsMarkers;
