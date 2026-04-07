import React, { useState, useEffect, useCallback } from "react";
import supabase from "../supabaseClient";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFlagColor(flag) {
  if (flag === "red") return { bg: "#FEE2E2", text: "#991B1B", dot: "#DC2626", label: "High Cancellations" };
  if (flag === "yellow") return { bg: "#FEF9C3", text: "#854D0E", dot: "#CA8A04", label: "Some Cancellations" };
  return { bg: "#DCFCE7", text: "#14532D", dot: "#16A34A", label: "On Track" };
}

function getVehicleStatusStyle(status) {
  if (status === "available") return { bg: "#DCFCE7", text: "#15803D" };
  if (status === "in_use") return { bg: "#FEF3C7", text: "#B45309" };
  return { bg: "#FEE2E2", text: "#B91C1C" };
}

function getVehicleStatusLabel(status) {
  if (status === "available") return "Available";
  if (status === "in_use") return "In Use";
  return "Maintenance";
}

function calcCancelRate(routes) {
  let total = 0;
  let cancelled = 0;
  for (const r of routes) {
    const stops = r.stops || [];
    total += stops.length;
    cancelled += stops.filter((s) => s.status === "cancelled").length;
  }
  if (total === 0) return 0;
  return (cancelled / total) * 100;
}

function calcFlag(cancelRate) {
  if (cancelRate >= 50) return "red";
  if (cancelRate >= 20) return "yellow";
  return "green";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ label, value }) {
  return (
    <div style={{
      backgroundColor: "#F0FDF4", borderRadius: 10,
      padding: "14px 18px", flex: 1, minWidth: 100,
    }}>
      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#245B43" }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", color: "#9CA3AF", marginBottom: 10, marginTop: 24,
    }}>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Driver() {
  const [drivers, setDrivers] = useState([]);
  const [allRoutes, setAllRoutes] = useState({});
  const [allPickups, setAllPickups] = useState({});
  const [unassignedVehicles, setUnassignedVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDriver, setSelectedDriver] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignMode, setAssignMode] = useState("existing");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

  const [vehicleStatusLoading, setVehicleStatusLoading] = useState(false);
  const [flagCounts, setFlagCounts] = useState({ red: 0, yellow: 0, green: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: driversData } = await supabase
        .from("users")
        .select("user_id, name, email, phone, depot_id, state_assigned")
        .eq("role", "driver")
        .order("name");

      if (!driversData || driversData.length === 0) {
        setDrivers([]);
        setLoading(false);
        return;
      }

      const driverIds = driversData.map((d) => d.user_id);

      const { data: vehiclesData } = await supabase
        .from("vehicles").select("*").in("driver_id", driverIds);

      const { data: unassigned } = await supabase
        .from("vehicles").select("*").is("driver_id", null);

      setUnassignedVehicles(unassigned || []);

      // FIX: Properly fetch routes with their stops
      const { data: routesData } = await supabase
        .from("routes")
        .select(`
          route_id, 
          collector_id, 
          route_date, 
          status, 
          total_distance_km, 
          total_volume_collected, 
          depot_transfer_confirmed,
          stops:dropoffs (
            dropoff_id,
            status,
            actual_volume,
            estimated_volume,
            user_address
          )
        `)
        .in("collector_id", driverIds)
        .order("route_date", { ascending: false });

      const { data: pickupsData } = await supabase
        .from("dropoffs")
        .select("dropoff_id, collector_id, user_address, actual_volume, collected_at, status")
        .in("collector_id", driverIds)
        .eq("dropoff_type", "home_pickup")
        .order("collected_at", { ascending: false });

      const routesByDriver = {};
      for (const r of routesData || []) {
        if (!routesByDriver[r.collector_id]) routesByDriver[r.collector_id] = [];
        routesByDriver[r.collector_id].push(r);
      }

      const pickupsByDriver = {};
      for (const p of pickupsData || []) {
        if (!pickupsByDriver[p.collector_id]) pickupsByDriver[p.collector_id] = [];
        pickupsByDriver[p.collector_id].push(p);
      }

      setAllRoutes(routesByDriver);
      setAllPickups(pickupsByDriver);

      const enriched = driversData.map((d) => {
        const vehicle = (vehiclesData || []).find((v) => v.driver_id === d.user_id) || null;
        const driverRoutes = routesByDriver[d.user_id] || [];
        const todayRoute = driverRoutes.find((r) => r.route_date === today) || null;
        const cancelRate = calcCancelRate(driverRoutes);
        const flag = calcFlag(cancelRate);
        return { ...d, vehicle, todayRoute, flag, cancelRate };
      });

      enriched.sort((a, b) => {
        const order = { red: 0, yellow: 1, green: 2 };
        return order[a.flag] - order[b.flag];
      });

      const counts = { red: 0, yellow: 0, green: 0 };
      for (const d of enriched) counts[d.flag]++;
      setFlagCounts(counts);
      setDrivers(enriched);
    } catch (err) {
      console.error("Error loading driver data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Sidebar ────────────────────────────────────────────────────────────────

  const openSidebar = (driver) => {
    setSelectedDriver(driver);
    setSidebarOpen(true);
    setShowAssignModal(false);
    setAssignError("");
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setSelectedDriver(null);
    setShowAssignModal(false);
    setAssignError("");
  };

  // ── Vehicle status ─────────────────────────────────────────────────────────

  const handleVehicleStatusChange = async (vehicleId, newStatus) => {
    if (!selectedDriver) return;
    setVehicleStatusLoading(true);
    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("vehicle_id", vehicleId);
      if (error) throw error;
      await loadData();
      setSelectedDriver((prev) =>
        prev ? { ...prev, vehicle: prev.vehicle ? { ...prev.vehicle, status: newStatus } : null } : null
      );
    } catch (err) {
      console.error("Error updating vehicle status:", err);
    } finally {
      setVehicleStatusLoading(false);
    }
  };

  // ── Vehicle assignment ─────────────────────────────────────────────────────

  const handleAssignVehicle = async () => {
    if (!selectedDriver) return;
    setAssignLoading(true);
    setAssignError("");
    try {
      if (assignMode === "existing") {
        if (!selectedVehicleId) { 
          setAssignError("Please select a vehicle."); 
          setAssignLoading(false); 
          return; 
        }
        
        // Check if vehicle is already assigned to another driver
        const { data: existing } = await supabase
          .from("vehicles")
          .select("driver_id")
          .eq("vehicle_id", selectedVehicleId)
          .single();
        
        // If vehicle is assigned to a DIFFERENT driver, block it
        if (existing?.driver_id && existing.driver_id !== selectedDriver.user_id) { 
          setAssignError("This vehicle is already assigned to another driver."); 
          setAssignLoading(false); 
          return; 
        }
        
        // FIX: If the driver already has a vehicle, first unset it
        if (selectedDriver.vehicle) {
          const { error: unsetError } = await supabase
            .from("vehicles")
            .update({ driver_id: null, updated_at: new Date().toISOString() })
            .eq("vehicle_id", selectedDriver.vehicle.vehicle_id);
          
          if (unsetError) throw unsetError;
        }
        
        // Then assign the new vehicle
        const { error } = await supabase
          .from("vehicles")
          .update({ 
            driver_id: selectedDriver.user_id, 
            updated_at: new Date().toISOString() 
          })
          .eq("vehicle_id", selectedVehicleId);
        
        if (error) throw error;
        
      } else { // New vehicle mode
        if (!newPlate.trim()) { 
          setAssignError("Please enter a license plate."); 
          setAssignLoading(false); 
          return; 
        }
        
        const cap = parseFloat(newCapacity);
        if (!cap || cap <= 0) { 
          setAssignError("Please enter a valid capacity."); 
          setAssignLoading(false); 
          return; 
        }
        
        // Check for duplicate plate
        const { data: dupCheck } = await supabase
          .from("vehicles")
          .select("vehicle_id")
          .eq("license_plate", newPlate.trim().toUpperCase());
        
        if (dupCheck && dupCheck.length > 0) { 
          setAssignError("A vehicle with this license plate already exists."); 
          setAssignLoading(false); 
          return; 
        }
        
        // FIX: If the driver already has a vehicle, first unset it
        if (selectedDriver.vehicle) {
          const { error: unsetError } = await supabase
            .from("vehicles")
            .update({ driver_id: null, updated_at: new Date().toISOString() })
            .eq("vehicle_id", selectedDriver.vehicle.vehicle_id);
          
          if (unsetError) throw unsetError;
        }
        
        // Then insert the new vehicle
        const { error } = await supabase.from("vehicles").insert({
          driver_id: selectedDriver.user_id,
          license_plate: newPlate.trim().toUpperCase(),
          capacity_litres: cap,
          status: "available",
        });
        
        if (error) throw error;
      }
      
      await loadData();
      setShowAssignModal(false);
      setNewPlate(""); 
      setNewCapacity(""); 
      setSelectedVehicleId("");
      
      // Refresh selected driver with updated data
      setSelectedDriver((prev) => {
        if (!prev) return null;
        const updatedDriver = drivers.find(d => d.user_id === prev.user_id);
        return updatedDriver || prev;
      });
      
    } catch (err) {
      console.error("Assign vehicle error:", err);
      setAssignError(err.message || "Failed to assign vehicle.");
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Sidebar stats ──────────────────────────────────────────────────────────

  const getSidebarStats = (driver) => {
    const routes = allRoutes[driver.user_id] || [];
    const pickups = allPickups[driver.user_id] || [];
    const completedRoutes = routes.filter((r) => r.status === "completed");
    const totalDistance = completedRoutes.reduce((s, r) => s + (r.total_distance_km || 0), 0);
    const totalVolume = pickups
      .filter((p) => p.status === "collected" || p.status === "reached_depot")
      .reduce((s, p) => s + (p.actual_volume || 0), 0);
    return { completedRoutes: completedRoutes.length, totalDistance, totalVolume, routes, pickups };
  };

  // ── Search & pagination ────────────────────────────────────────────────────

  const filteredDrivers = drivers.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.phone && d.phone.includes(searchQuery))
  );

  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / PAGE_SIZE));
  const pagedDrivers = filteredDrivers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearch = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  // ── Sidebar drawer renderer ────────────────────────────────────────────────

  const renderSidebar = () => {
    if (!sidebarOpen || !selectedDriver) return null;
    const { completedRoutes, totalDistance, totalVolume, routes, pickups } = getSidebarStats(selectedDriver);
    const flagStyle = getFlagColor(selectedDriver.flag);

    return (
      <>
        <div
          onClick={closeSidebar}
          style={{
            position: "fixed", inset: 0,
            backgroundColor: "rgba(0,0,0,0.25)",
            zIndex: 40,
          }}
        />
        <div style={{
          position: "fixed", top: 0, right: 0,
          width: 460, height: "100vh",
          backgroundColor: "#FFFFFF",
          boxShadow: "-4px 0 32px rgba(0,0,0,0.13)",
          zIndex: 50,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Pinned header */}
          <div style={{ backgroundColor: "#245B43", padding: "20px 24px", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#FFFFFF" }}>{selectedDriver.name}</div>
                <div style={{ fontSize: 12, color: "#A5D6A7", marginTop: 3 }}>{selectedDriver.email}</div>
              </div>
              <button
                onClick={closeSidebar}
                style={{
                  background: "rgba(255,255,255,0.15)", border: "none",
                  color: "#FFFFFF", width: 30, height: 30, borderRadius: "50%",
                  cursor: "pointer", fontSize: 16, display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              backgroundColor: flagStyle.bg, borderRadius: 6,
              padding: "4px 10px", marginTop: 10,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: flagStyle.dot }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: flagStyle.text }}>
                {flagStyle.label} — {selectedDriver.cancelRate.toFixed(0)}% cancellation rate
              </span>
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>

            <SectionTitle>Today's Status</SectionTitle>
            {selectedDriver.todayRoute ? (() => {
              const stops = selectedDriver.todayRoute.stops || [];
              // FIX: Include reached_depot in completed count
              const done = stops.filter((s) => 
                s.status === "collected" || 
                s.status === "reached_depot" || 
                s.status === "cancelled"
              ).length;
              return (
                <div style={{ backgroundColor: "#F0FDF4", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                      Route {selectedDriver.todayRoute.route_date}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                      ...(selectedDriver.todayRoute.status === "active"
                        ? { backgroundColor: "#FEF3C7", color: "#B45309" }
                        : selectedDriver.todayRoute.status === "completed"
                        ? { backgroundColor: "#DCFCE7", color: "#15803D" }
                        : { backgroundColor: "#EFF6FF", color: "#1D4ED8" }),
                    }}>
                      {selectedDriver.todayRoute.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>
                    Stops: {done} / {stops.length} completed
                  </div>
                  <div style={{ backgroundColor: "#D1FAE5", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 4, backgroundColor: "#245B43",
                      width: stops.length > 0 ? `${(done / stops.length) * 100}%` : "0%",
                      transition: "width 0.3s",
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>
                    Depot transfer:{" "}
                    {selectedDriver.todayRoute.depot_transfer_confirmed
                      ? <span style={{ color: "#15803D", fontWeight: 700 }}>Confirmed</span>
                      : <span style={{ color: "#D97706", fontWeight: 700 }}>Pending</span>
                    }
                  </div>
                </div>
              );
            })() : (
              <div style={{ fontSize: 13, color: "#9CA3AF", padding: "10px 0" }}>No route assigned today.</div>
            )}

            <SectionTitle>Lifetime Stats</SectionTitle>
            <div style={{ display: "flex", gap: 10 }}>
              <StatBox label="Routes Completed" value={completedRoutes} />
              <StatBox label="Distance Driven" value={`${totalDistance.toFixed(1)} km`} />
              <StatBox label="UCO Collected" value={`${totalVolume.toFixed(1)} L`} />
            </div>

            <SectionTitle>Vehicle Assignment</SectionTitle>
            {selectedDriver.vehicle ? (
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                      {selectedDriver.vehicle.license_plate}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                      Capacity: {selectedDriver.vehicle.capacity_litres}L
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
                    ...getVehicleStatusStyle(selectedDriver.vehicle.status),
                  }}>
                    {getVehicleStatusLabel(selectedDriver.vehicle.status)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Change Status
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { value: "available", label: "Available", activeColor: "#15803D", activeBg: "#DCFCE7" },
                    { value: "in_use", label: "In Use", activeColor: "#B45309", activeBg: "#FEF3C7", disabled: true },
                    { value: "out_of_service", label: "Maintenance", activeColor: "#B91C1C", activeBg: "#FEE2E2" },
                  ].map((btn) => {
                    const isActive = selectedDriver.vehicle.status === btn.value;
                    return (
                      <button
                        key={btn.value}
                        disabled={isActive || btn.disabled || vehicleStatusLoading}
                        onClick={() => handleVehicleStatusChange(selectedDriver.vehicle.vehicle_id, btn.value)}
                        style={{
                          flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                          cursor: isActive || btn.disabled ? "default" : "pointer",
                          border: isActive ? "none" : "1px solid #E5E7EB",
                          backgroundColor: isActive ? btn.activeBg : "#FFFFFF",
                          color: isActive ? btn.activeColor : "#6B7280",
                          opacity: btn.disabled && !isActive ? 0.5 : 1,
                          transition: "all 0.15s",
                        }}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 10 }}>
                No vehicle assigned to this driver.
              </div>
            )}

            <button
              onClick={() => { setShowAssignModal(true); setAssignError(""); }}
              style={{
                marginTop: 10, width: "100%", padding: "10px",
                backgroundColor: "#245B43", color: "#FFFFFF",
                border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              {selectedDriver.vehicle ? "Reassign Vehicle" : "Assign Vehicle"}
            </button>

            {showAssignModal && (
              <div style={{
                marginTop: 14, border: "1px solid #E5E7EB",
                borderRadius: 12, padding: 16, backgroundColor: "#FAFAFA",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
                  Assign Vehicle to {selectedDriver.name}
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { value: "existing", label: "Existing Vehicle" },
                    { value: "new", label: "New Vehicle" },
                  ].map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setAssignMode(m.value)}
                      style={{
                        flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                        cursor: "pointer", border: "none",
                        backgroundColor: assignMode === m.value ? "#245B43" : "#E5E7EB",
                        color: assignMode === m.value ? "#FFFFFF" : "#6B7280",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {assignMode === "existing" ? (
                  <div>
                    {unassignedVehicles.length === 0 ? (
                      <div style={{ fontSize: 13, color: "#9CA3AF" }}>No unassigned vehicles available.</div>
                    ) : (
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8,
                          border: "1px solid #D1D5DB", fontSize: 13,
                          backgroundColor: "#FFFFFF", color: "#111827",
                        }}
                      >
                        <option value="">Select a vehicle...</option>
                        {unassignedVehicles.map((v) => (
                          <option key={v.vehicle_id} value={v.vehicle_id}>
                            {v.license_plate} — {v.capacity_litres}L
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>
                        License Plate
                      </label>
                      <input
                        value={newPlate}
                        onChange={(e) => setNewPlate(e.target.value)}
                        placeholder="e.g. WXY 1234"
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8,
                          border: "1px solid #D1D5DB", fontSize: 13,
                          backgroundColor: "#FFFFFF", boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>
                        Capacity (Litres)
                      </label>
                      <input
                        value={newCapacity}
                        onChange={(e) => setNewCapacity(e.target.value)}
                        placeholder="e.g. 500"
                        type="number"
                        min="1"
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8,
                          border: "1px solid #D1D5DB", fontSize: 13,
                          backgroundColor: "#FFFFFF", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                )}

                {assignError && (
                  <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 10, fontWeight: 600 }}>
                    {assignError}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => { setShowAssignModal(false); setAssignError(""); }}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: "pointer", border: "1px solid #E5E7EB",
                      backgroundColor: "#FFFFFF", color: "#6B7280",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignVehicle}
                    disabled={assignLoading}
                    style={{
                      flex: 2, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: "pointer", border: "none",
                      backgroundColor: "#245B43", color: "#FFFFFF",
                      opacity: assignLoading ? 0.7 : 1,
                    }}
                  >
                    {assignLoading ? "Assigning..." : "Confirm Assignment"}
                  </button>
                </div>
              </div>
            )}

            <SectionTitle>Route History</SectionTitle>
            {routes.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>No routes yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {routes.slice(0, 10).map((r) => {
                  const stops = r.stops || [];
                  const collected = stops.filter((s) => s.status === "collected" || s.status === "reached_depot").length;
                  const cancelled = stops.filter((s) => s.status === "cancelled").length;
                  return (
                    <div key={r.route_id} style={{ border: "1px solid #F3F4F6", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                          {new Date(r.route_date).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                          ...(r.status === "completed"
                            ? { backgroundColor: "#DCFCE7", color: "#15803D" }
                            : r.status === "active"
                            ? { backgroundColor: "#FEF3C7", color: "#B45309" }
                            : { backgroundColor: "#EFF6FF", color: "#1D4ED8" }),
                        }}>
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6B7280" }}>
                        <span>{collected} collected</span>
                        {cancelled > 0 && <span style={{ color: "#DC2626" }}>{cancelled} cancelled</span>}
                        {r.total_distance_km && <span>{r.total_distance_km.toFixed(1)} km</span>}
                        {r.total_volume_collected && <span>{r.total_volume_collected.toFixed(1)} L</span>}
                      </div>
                      {r.status === "completed" && (
                        <div style={{ fontSize: 11, marginTop: 5 }}>
                          Depot transfer:{" "}
                          <span style={{ fontWeight: 700, color: r.depot_transfer_confirmed ? "#15803D" : "#D97706" }}>
                            {r.depot_transfer_confirmed ? "Confirmed" : "Pending"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <SectionTitle>Recent Pickups</SectionTitle>
            {pickups.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>No pickups yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
                {pickups.slice(0, 8).map((p) => (
                  <div key={p.dropoff_id} style={{
                    border: "1px solid #F3F4F6", borderRadius: 10, padding: "10px 14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: "#111827",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {p.user_address || "Address not available"}
                      </div>
                      {p.collected_at && (
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                          {new Date(p.collected_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      {p.actual_volume ? (
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#245B43" }}>{p.actual_volume}L</div>
                      ) : null}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                        ...(p.status === "collected" || p.status === "reached_depot"
                          ? { backgroundColor: "#DCFCE7", color: "#15803D" }
                          : { backgroundColor: "#FEE2E2", color: "#B91C1C" }),
                      }}>
                        {p.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F2F5F0", fontFamily: "'Inter', sans-serif" }}>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 40px" }}>

        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: "#245B43", margin: 0, lineHeight: 1.2 }}>
            Driver Management
          </h1>
          <p style={{ marginTop: 8, fontSize: 18, color: "#245B43", opacity: 0.75, margin: "8px 0 0" }}>
            {drivers.length} drivers registered
          </p>
        </div>

        {/* Search bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            backgroundColor: "#FFFFFF", borderRadius: 10,
            border: "1px solid #E5E7EB", padding: "10px 14px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search drivers by name, email or phone..."
              style={{
                flex: 1, border: "none", outline: "none",
                fontSize: 13, color: "#111827", backgroundColor: "transparent",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch("")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#9CA3AF", fontSize: 16, lineHeight: 1, padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Flag summary row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {[
            { flag: "red", count: flagCounts.red, label: "High Cancellation Rate" },
            { flag: "yellow", count: flagCounts.yellow, label: "Some Cancellations" },
            { flag: "green", count: flagCounts.green, label: "Performing Well" },
          ].map(({ flag, count, label }) => {
            const style = getFlagColor(flag);
            return (
              <div key={flag} style={{
                backgroundColor: style.bg, borderRadius: 12,
                padding: "14px 20px", flex: 1,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: style.dot, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: style.text }}>{count}</div>
                  <div style={{ fontSize: 12, color: style.text, opacity: 0.8 }}>{label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Driver table */}
        <div style={{
          backgroundColor: "#FFFFFF", borderRadius: 16,
          overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              Loading drivers...
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              No drivers found.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAF9", borderBottom: "1px solid #E5E7EB" }}>
                  {["", "Driver", "Email", "Phone", "Depot", "Vehicle", "Today", ""].map((h, i) => (
                    <th key={i} style={{
                      padding: "12px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, color: "#9CA3AF",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedDrivers.map((driver, idx) => {
                  const flagStyle = getFlagColor(driver.flag);
                  const isSelected = selectedDriver?.user_id === driver.user_id;
                  return (
                    <tr
                      key={driver.user_id}
                      style={{
                        borderBottom: idx < pagedDrivers.length - 1 ? "1px solid #F3F4F6" : "none",
                        backgroundColor: isSelected ? "#F0FDF4" : "transparent",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onClick={() => openSidebar(driver)}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#FAFAFA"; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <td style={{ padding: "14px 16px", width: 16 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: flagStyle.dot }} />
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{driver.name}</div>
                        {driver.cancelRate > 0 && (
                          <div style={{ fontSize: 11, color: flagStyle.dot, marginTop: 2 }}>
                            {driver.cancelRate.toFixed(0)}% cancellation rate
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "#6B7280" }}>{driver.email}</td>
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "#6B7280" }}>{driver.phone || "—"}</td>
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "#6B7280" }}>{driver.depot_id || "—"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        {driver.vehicle ? (
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{driver.vehicle.license_plate}</div>
                            <div style={{ fontSize: 11, marginTop: 2 }}>
                              <span style={{
                                ...getVehicleStatusStyle(driver.vehicle.status),
                                padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              }}>
                                {getVehicleStatusLabel(driver.vehicle.status)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#D97706", fontWeight: 600 }}>No vehicle</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {driver.todayRoute ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                            ...(driver.todayRoute.status === "active"
                              ? { backgroundColor: "#FEF3C7", color: "#B45309" }
                              : driver.todayRoute.status === "completed"
                              ? { backgroundColor: "#DCFCE7", color: "#15803D" }
                              : { backgroundColor: "#EFF6FF", color: "#1D4ED8" }),
                          }}>
                            {driver.todayRoute.status.toUpperCase()}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: "#9CA3AF" }}>No route</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#D1D5DB", fontSize: 16 }}>→</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {!loading && filteredDrivers.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px", borderTop: "1px solid #F3F4F6",
            }}>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredDrivers.length)} of {filteredDrivers.length} drivers
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                    border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF",
                    color: currentPage === 1 ? "#D1D5DB" : "#374151",
                    cursor: currentPage === 1 ? "default" : "pointer",
                  }}
                >← Prev</button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === "..." ? (
                      <span key={`ellipsis-${i}`} style={{ fontSize: 12, color: "#9CA3AF", padding: "0 4px" }}>…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setCurrentPage(item)}
                        style={{
                          width: 32, height: 32, borderRadius: 7, fontSize: 12, fontWeight: 700,
                          border: currentPage === item ? "none" : "1px solid #E5E7EB",
                          backgroundColor: currentPage === item ? "#245B43" : "#FFFFFF",
                          color: currentPage === item ? "#FFFFFF" : "#374151",
                          cursor: "pointer",
                        }}
                      >{item}</button>
                    )
                  )
                }

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                    border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF",
                    color: currentPage === totalPages ? "#D1D5DB" : "#374151",
                    cursor: currentPage === totalPages ? "default" : "pointer",
                  }}
                >Next →</button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Fixed sidebar drawer */}
      {renderSidebar()}

    </div>
  );
}

export default Driver;