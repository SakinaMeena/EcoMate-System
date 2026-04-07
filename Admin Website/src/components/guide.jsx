import "./Guide.css";
import React from "react";


function Guide({ onClose }) {
  return (
    <div className="guide-float">
      <div className="guide-header">
         <div className="classification-font3"> 
          Classification Guide
        </div>
        <button className="guide-close" type="button" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="guide-content">
         <div className="classification-font"> 
        Low performance </div>

          <div className="classification-font2"> 

        Represents stations or states with total collected volume from 0 up to the Low value.
        </div>


        <div className="classification-font"> 
  
        Medium performance
        </div>

        <div className="classification-font2"> 

        Represents stations or states with volume greater than Low and up to the Medium value.
         </div>

          <div className="classification-font">
        High performance

          </div>
          <div className="classification-font2">
         Automatically represents stations or state with volume greater than Medium.
          </div>

        <p className="guide-note">Values may include decimals </p>
      </div>
    </div>
  );
}

export default Guide;
