import { Outlet } from "react-router-dom";
import React from "react";

export default function AppLayout() {
  return (
    <div className="pageBackground">

      <div className="greyContainer">

        <Outlet />

        <div className="bottomTag">@EcoMate</div>

      </div>

    </div>
  );
}
