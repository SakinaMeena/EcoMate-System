
import React, { useState, useEffect, useMemo } from "react";
import "./searchpanel.css";
import supabase from "../supabaseClient";
import Guide from "./guide";
import "./guide.jsx";
   
function SearchPanel({  onClose,  onApply,  stateApply,  onReset, showResults, setShowResults,onDownloadPDF }) {   //connect function to gisplatform;
  
   const [low, setlow] = useState("");
   const [medium, setmedium] = useState("");
   const [stateValue, setStateValue] = useState("");
   const [startDate, setStartDate] = useState("");
   const [endDate, setEndDate] = useState("");
   const [stationValue, setStationValue] = useState("");
   const [allStationRows, setAllStations] = useState([]);
   const [stateOptions, setStateOptions] = useState([]);
   const [error, setError] = useState("");
   const [error1, setError1] = useState("");

   const [showGuide, setShowGuide] = useState(false);

   const [collapsed, setCollapsed] = useState(false);
   const [mode, setMode] = useState("icons"); // icon mode
   const [statemode, setstateMode] =  useState("both");  // state mode
   const [showDownloadMenu, setShowDownloadMenu] = useState(false);
   const [selectedCategories, setSelectedCategories] = useState(["all"]);
   


  
    
    useEffect(() => {
  
     const loadStates = async () => {
      setError("");
      
      const { data, error } = await supabase  // connecting to the database ;

        .from("stations_markers")
        .select("name, state");

        if (error) {
          setError("Hmm… something didn't work as expected. Refresh the page to retry.")
        console.error(error);
        return;
      }
  
      setAllStations(data || []);

      const uniquestate = [...new Set((data || []).map((r) => r.state).filter(Boolean))];  
      
      uniquestate.sort(); 
    
      setStateOptions(uniquestate);
     
      };
    
      loadStates();
      
     }, []);



     const stationOptions = useMemo(() => {
     if (!stateValue) {

      return [...new Set(
      allStationRows.map(r => r.name).filter(Boolean)
       )].sort();
       }

      
      return [...new Set(
        allStationRows
      .filter(r => r.state === stateValue)
      .map(r => r.name)
      .filter(Boolean)
       )].sort();
        }, [allStationRows, stateValue]
      );

       useEffect(() => {
       setStationValue("");
       }, [stateValue]);

      
       const stateHandle = () => {
        
        setError1("");

        if(stateValue === "" && stationValue === ""){
          setError1("Please select a state or  a station.");
          return;
        }
        

       stateApply(stateValue, stationValue);  
       
        
        };

       
       const resetFilterState = () => {
       setStateValue("");
       setStationValue("");
       }



      const applyFilters = () => {
        setError("");
        const rawValues = [low, medium];
          if (rawValues.some((v) => v === "")) {
          setError("Please fill in all category fields.");
        return;
             }
            const lowNum = Number(low);
            const mediumNum = Number(medium);
            if (!Number.isFinite(lowNum) || !Number.isFinite(mediumNum)) {
            setError("Low and Medium must be valid numbers.");
            return;
            }
                //overlay range
            if (lowNum >= mediumNum) {
            setError("Low performance cannot be higher than or equal to Medium.");
            return;
            }
             // 3) Validate dates 
         if (!startDate || !endDate) {
           setError("Please select Start Date and End Date.");
             return;
        }
          if (endDate < startDate) {
          setError("End Date cannot be before Start Date.");
            return;
        }


          //value being pass to the gisplatform.
          const payload = {
   
          startDate,  
          endDate,   
          lowNum,
          mediumNum,
          mode,        
          statemode, 
    
          };



          console.log("SearchPanel payload:", payload);
        onApply(payload);   // straight to the GIS platform. 
   


        };

           const resetFilterclassification = () => {
  
          setStartDate("");
          setEndDate("");
          setmedium("");
          setlow("");
         //  error("");
           
         onReset?.();
          };
         
           const closteDownloadMenu = () => {
            setShowDownloadMenu(false);
           }
  


return collapsed ? (

  
  <button
    type="button"
    className="collapsed-tab"
    onClick={() => setCollapsed(false)}
    title="Open Search Panel"
  >
     Search panel
  </button>

) : (

  
  <div className="overlay-panel">

    <div className="main-header">

      <div className="overlay-header">
        <h3>Search Panel</h3>

        <div className="header-actions">
          <button
            type="button"
            className="min-btn"
            onClick={() => setCollapsed(true)}
            title="Minimize"
          >
            —
          </button>

          <button
            className="close-btn"
            type="button"
            onClick={onClose}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

</div>
      

      <div className="searchpanel-input">
    
         <div className="classification-font"> 
          Location
          </div>
         <select
          className="input-field2"
          value={stateValue}
          onChange={(e) => setStateValue(e.target.value)}
         >
          <option value="">Select a state</option>
          {stateOptions.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      
             </div>

        <div className="stationsearch">
          <div className="classification-font"> 
           Station
          </div>
                <input
          type="text"
          className="input-field2"
          value={stationValue}
          onChange={(e) => setStationValue(e.target.value)}
          placeholder="Enter station name"
          list="station-suggestions"
        />
        <datalist id="station-suggestions">
          {stationOptions.map((nm) => (
            <option key={nm} value={nm} />
          ))}
        </datalist>
          </div>



        <div className="search-button"   > 


          <button type="button"
        onClick={resetFilterState}  
          className="apply-clear"
        >Clear</button>

          <button type="button" 
       
       onClick={stateHandle}   
       

       
       className="apply-search"
       >Search
       </button>

        




       </div>



      {error1 && <p className="error-text">{error1}</p>}





<div className="classificationbox">
      
       
          <div className="hell">

            <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="icons">Icon based categories</option>
            <option value="state">State classification</option>
            </select>
            

            {mode === "state" && (

              <div className="state">

             <select value={statemode} onChange={(e) => setstateMode(e.target.value)}>
                  <option value="both">home & station</option>
                  <option value="home">Home pick-up only</option>
                  <option value="station">station pick up only</option>
             </select>
              </div>
            
             )}

            

    
              <button
               type="button"
               className="guide-btn"
               onClick={() => setShowGuide((v) => !v)}
               title="Classification guide"
               >
               ⓘ
              </button>

               </div>

              <div className="classification-font"> 
          
           Low performance (max value)

           </div> 
           <div className="category1">
                   
                   
 <div className="lowmin">
   
    <input
      type="number"
      className="input-field"
      value={low}
      min={0}
      onChange={(e) => setlow(e.target.value)}
      
    />
       </div>

  </div> 


  <div className="classification-font"> 
         Medium  performance (max value) 
    </div>


        <div className="category2">
                   
                   
 <div className="lowmedial">
   
    <input
      type="number"
      step= "any"
      className="input-field"
      value={medium}
      
      onChange={(e) => setmedium(e.target.value)}
      
    />
       </div>
    

  </div> 
   

   <div className="high1">

  <div className="classification-font"> 
   High performance
     </div> 
    <input
  type="text"
  className="input-field"
  value={medium ? `> ${medium}` : ""}  
  readOnly
/>

       </div>

<div className="classification-font"> 
     Date Range 
        </div>
    <div className="date-range">
 
   

  <div className="Datesearch">

     <div className="classification-font"> 
     From 
        </div>


    <input
      type="date"
      className="input-field1"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
    />
  </div>

  <div className="Datesearch">


    <div className="classification-font"> 
     To
        </div>
    <input
      type="date"
      className="input-field1"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
      min={startDate}   
    />
    </div>

    </div>

      {error && <p className="error-text">{error}</p>}

        <div className="button">

       
    
       <button type="button"
        onClick={resetFilterclassification}
        className="apply-reset"
        >Reset</button>


        <button onClick={applyFilters}
       
       className="apply-btn">
        
        Apply
        
        </button>

      </div>

  {showGuide && (
  <Guide onClose={() => setShowGuide(false)} />
         )}
</div>

<div className="view-button" >


<button
  type="button"
  onClick={() => setShowResults((v) => !v)}
  className={`results-btn1 ${showResults ? "hide" : "view"}`}
>
  {showResults ? "Hide Results" : "View Results"}
</button>


<div className="download-wrapper">

  <button
    type="button"
    className="results-btn"
    onClick={() => setShowDownloadMenu(v => !v)}
  >
    Download Results
  </button>

  {showDownloadMenu && (

    <div className="download-menu">
        <button
            className="close-btn20"
            type="button"
            onClick={closteDownloadMenu}
            title="Close"
          >
            ✕
          </button>

      <label>
        <input
          type="checkbox"
          checked={selectedCategories.includes("all")}
          onChange={() => setSelectedCategories(["all"])}
        />
        All
      </label>

      <label>
        <input
          type="checkbox"
          checked={selectedCategories.includes("low")}
          onChange={(e)=>{
            let updated=[...selectedCategories];
            if(e.target.checked) updated.push("low");
            else updated=updated.filter(v=>v!=="low");
            setSelectedCategories(updated.filter(v=>v!=="all"));
          }}
        />
        Low
      </label>

      <label>
        <input
          type="checkbox"
          checked={selectedCategories.includes("medium")}
          onChange={(e)=>{
            let updated=[...selectedCategories];
            if(e.target.checked) updated.push("medium");
            else updated=updated.filter(v=>v!=="medium");
            setSelectedCategories(updated.filter(v=>v!=="all"));
          }}
        />
        Medium
      </label>

      <label>
        <input
          type="checkbox"
          checked={selectedCategories.includes("high")}
          onChange={(e)=>{
            let updated=[...selectedCategories];
            if(e.target.checked) updated.push("high");
            else updated=updated.filter(v=>v!=="high");
            setSelectedCategories(updated.filter(v=>v!=="all"));
          }}
        />
        High
      </label>

      <button
        className="export-btn"
        onClick={()=>{
          const name = window.prompt("Enter file name","Results");
          if(!name) return;

          onDownloadPDF(name, selectedCategories);
          setShowDownloadMenu(false);
        }}
      >
        Export PDF
      </button>

    </div>

  )}

</div>

</div>

     
     </div>
  );
}



export default SearchPanel;


