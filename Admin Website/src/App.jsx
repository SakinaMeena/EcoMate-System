import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./app.css";

import Login from "./page/mainlogin.jsx";
import Dashboard from "./page/Dashboard.jsx";
import Audit from "./page/audit.jsx";
import GISPlatform from "./page/GISPlatform.jsx";
import Driver from "./page/driver.jsx";

import Login03 from "./page/resetpassword.jsx";
import ForgotPass from "./page/forgotpass.jsx";


import "leaflet/dist/leaflet.css";
import Login02 from "./page/OTPpage.jsx";

import RequireAdmin from "./components/RequireAuth";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgotpass" element={<ForgotPass />} />
        <Route path="/login3" element={<Login03 />} />
        

        <Route element={<RequireAdmin />}>
          <Route path="/login2" element={<Login02 />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/GISPlatform" element={<GISPlatform />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/driver" element={<Driver />} />
         
          
        
        </Route>

        <Route path="*" element={<h1>Page Not Found - Check your URL</h1>} />
      </Routes>
    </BrowserRouter>
  );
}