import React from "react";
import "./ControlPanelButton.css";

function ControlPanelButton({
  setActiveView,
  isControlOpen,
  setIsControlOpen,
  setIsMinimized,
}) {
  const togglePanel = () => {
    
    setIsMinimized(false);
    setIsControlOpen((prev) => !prev);
  };

  const choose = (view) => {
    setActiveView(view);
    setIsControlOpen(false);  
    setIsMinimized(false);    
  };

  return (
    <div className="control-panel-container">
      <button className="control-panel-button" type="button" onClick={togglePanel}>
        <div className="panel-left">
          <span className="icon-hamburger">☰</span>
          <span className="panel-title">Control Panel</span>
        </div>

        <span className={`icon-chevron ${isControlOpen ? "open" : ""}`}>▼</span>
      </button>

      {isControlOpen && (
        <div className="control-panel-body">
          <button className="panel-option" onClick={() => choose("search")}>
            Search Panel
          </button>

          <button className="panel-option" onClick={() => choose("heatmap")}>
            Collection Heatmap
          </button>
        </div>
      )}
    </div>
  );
}

export default ControlPanelButton;