import React, { useState, useEffect, useMemo } from 'react';
import './dashboard.css';
import { useNavigate } from 'react-router-dom';
import supabase from "../supabaseClient";
import companyLogo from "./logo.png";
import ProfilePanel from "../components/profile";

// Recharts & Icons
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { FaOilCan, FaLeaf, FaWater } from 'react-icons/fa';

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, unit, changePct, icon: Icon, color, sparkData = [] }) {
  const isPositive = changePct >= 0;
  return (
    <div className="kpi-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="kpi-header">
        <Icon className="kpi-icon" style={{ color }} />
        <h3>{title}</h3>
      </div>
      <div className="kpi-value">
        {value.toLocaleString()} {unit}
      </div>
      <div className={`kpi-change ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? '↑' : '↓'} {Math.abs(changePct).toFixed(1)}% vs last month
      </div>
      {sparkData.length > 0 && (
        <div className="kpi-sparkline">
          <ResponsiveContainer width="100%" height={50}>
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey="value" stroke={color} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="kpi-footnote">
        {title.includes('CO2') && '≈ 2.5 kg CO2 saved per litre (Malaysia B20/NETR basis)'}
        {title.includes('Water') && '≈ 1M litres protected per litre recycled'}
      </p>
    </div>
  );
}

// ─── Series config ────────────────────────────────────────────────────────────

const SERIES = [
  { key: 'uco',   label: 'UCO (L)',     color: '#10B981', dataKey: 'uco'   },
  { key: 'co2',   label: 'CO₂ (kg)',    color: '#3B82F6', dataKey: 'co2'   },
  { key: 'water', label: 'Water (M L)', color: '#06B6D4', dataKey: 'water' },
];

// ─── Chart Controls Sidebar ───────────────────────────────────────────────────

function ChartControls({ allMonths, fromIdx, toIdx, onFromChange, onToChange, activeSeries, onToggleSeries }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 20,
      backgroundColor: '#F9FAF9', borderRadius: 14,
      border: '1px solid #E5E7EB', padding: '20px 18px',
      minWidth: 160, width: 160, flexShrink: 0,
    }}>
      {/* Month range */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9CA3AF', marginBottom: 12 }}>
          Date Range
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>
              From
            </label>
            <select
              value={fromIdx}
              onChange={e => onFromChange(Number(e.target.value))}
              style={selectStyle}
            >
              {allMonths.map((m, i) => (
                <option key={m} value={i} disabled={i > toIdx}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>
              To
            </label>
            <select
              value={toIdx}
              onChange={e => onToChange(Number(e.target.value))}
              style={selectStyle}
            >
              {allMonths.map((m, i) => (
                <option key={m} value={i} disabled={i < fromIdx}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #E5E7EB' }} />

      {/* Series toggles */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9CA3AF', marginBottom: 12 }}>
          Show / Hide
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SERIES.map(s => {
            const active = activeSeries.includes(s.key);
            return (
              <button
                key={s.key}
                onClick={() => onToggleSeries(s.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${active ? s.color : '#E5E7EB'}`,
                  backgroundColor: active ? `${s.color}14` : '#FFFFFF',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: active ? s.color : '#D1D5DB',
                  transition: 'background 0.15s',
                }} />
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: active ? s.color : '#9CA3AF',
                }}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => {
          onFromChange(0);
          onToChange(allMonths.length - 1);
          SERIES.forEach(s => { if (!activeSeries.includes(s.key)) onToggleSeries(s.key); });
        }}
        style={{
          marginTop: 'auto', padding: '8px', borderRadius: 8, fontSize: 12,
          fontWeight: 600, cursor: 'pointer', border: '1px solid #E5E7EB',
          backgroundColor: '#FFFFFF', color: '#6B7280',
        }}
      >
        Reset View
      </button>
    </div>
  );
}

const selectStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid #D1D5DB', fontSize: 12,
  backgroundColor: '#FFFFFF', color: '#111827',
  outline: 'none', cursor: 'pointer',
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);

  const permissions = {
    super_admin: ['management', 'awareness'],
    admin_management: ['management'],
    admin_awareness: ['awareness'],
  };

  const canAccessAwareness = permissions[role]?.includes('awareness');

  const [kpiData, setKpiData] = useState({
    currentMonth: { uco: 0, co2: 0, water: 0 },
    prevMonth:    { uco: 0, co2: 0, water: 0 },
    changePct: 0,
  });

  const [monthlyTrends, setMonthlyTrends] = useState([]);

  // Chart filter state
  const [fromIdx, setFromIdx]       = useState(0);
  const [toIdx, setToIdx]           = useState(0);
  const [activeSeries, setActiveSeries] = useState(['uco', 'co2', 'water']);

  const navigate = useNavigate();

  const today = new Date().toLocaleDateString('en-UK', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  useEffect(() => {
    const loadUser = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const user = authData.user;

      const { data: row } = await supabase
        .from('users')
        .select('name,email,phone,role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (row) { setProfile(row); setRole(row.role); return; }

      if (user.email) {
        const { data: fallback } = await supabase
          .from('users')
          .select('name,email,phone,role')
          .eq('email', user.email)
          .maybeSingle();
        if (fallback) { setProfile(fallback); setRole(fallback.role); }
      }
    };

    loadUser();

    const fetchKpis = async () => {
      try {
        const { data: monthly, error } = await supabase
          .rpc('get_monthly_kpi_summary', { lookback_months: 12 });

        if (error) throw error;

        if (monthly && monthly.length >= 2) {
          const current  = monthly[0];
          const previous = monthly[1];

          const change = Number(previous.uco_liters) === 0
            ? 0
            : ((Number(current.uco_liters) - Number(previous.uco_liters)) / Number(previous.uco_liters)) * 100;

          setKpiData({
            currentMonth: {
              uco:   Number(current.uco_liters)   || 0,
              co2:   Number(current.co2_kg)        || 0,
              water: Number(current.water_liters)  || 0,
            },
            prevMonth: {
              uco:   Number(previous.uco_liters)  || 0,
              co2:   Number(previous.co2_kg)       || 0,
              water: Number(previous.water_liters) || 0,
            },
            changePct: change,
          });

          const formatted = monthly
            .map(m => ({
              month: new Date(m.month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
              uco:   Number(m.uco_liters)  || 0,
              co2:   Number(m.co2_kg)       || 0,
              water: (Number(m.water_liters) || 0) / 1_000_000,
            }))
            .reverse();

          setMonthlyTrends(formatted);
          setToIdx(formatted.length - 1);
        }
      } catch (err) {
        console.error('Error fetching monthly KPIs:', err);
      }
    };

    fetchKpis();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  const handleToggleSeries = (key) => {
    setActiveSeries(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(k => k !== key) : prev  // keep at least one
        : [...prev, key]
    );
  };

  // Slice trend data to selected range
  const allMonths     = monthlyTrends.map(d => d.month);
  const visibleTrends = useMemo(
    () => monthlyTrends.slice(fromIdx, toIdx + 1),
    [monthlyTrends, fromIdx, toIdx]
  );

  return (
    <div className="website-container">
      {/* Top bar */}
      <div className="dashboard-bar2">
        <header className="Appname">
          <h1>EcoMate Admin Dashboard</h1>
        </header>
        <div className="login-head">
          <img src={companyLogo} alt="Company Logo" className="logo-image2" />
        </div>
      </div>

      {/* Nav bar */}
      <div className="dashboard-bar">
        <div className="username">
          <h2>Welcome, {profile?.name ?? '-'}</h2>
        </div>
        <div className="Date">
          <h3>{today}</h3>
        </div>
        <div className="user-profile">
          {canAccessAwareness && (
            <button type="button" className="logout-button" onClick={() => navigate('/gamification')}>
              Awareness
            </button>
          )}
          <button type="button" className="logout-button" onClick={() => setProfileOpen(true)}>
            Profile
          </button>
          <ProfilePanel
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            profile={profile}
            onProfileUpdate={(patch) => setProfile(prev => ({ ...prev, ...patch }))}
          />
          <button type="button" className="logout-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="dashboard-layout">
        <aside className="panel">
          <div className="menu-wrapper">
            <nav className="site-nav">
              <ul>
                <li onClick={() => navigate('/GISPlatform')} style={{ cursor: 'pointer' }}>
                  Spatial Insights
                </li>
              </ul>
            </nav>
            <nav className="site-nav2">
              <ul>
                <li onClick={() => navigate('/audit')} style={{ cursor: 'pointer' }}>
                  Audit
                </li>
              </ul>
            </nav>
            <nav className="site-nav2">
              <ul>
                <li onClick={() => navigate('/driver')} style={{ cursor: 'pointer' }}>
                  Driver
                </li>
              </ul>
            </nav>
          </div>
        </aside>

        <section className="kpi-section">
          {/* KPI cards */}
          <div className="kpi-grid">
            <KpiCard
              title="UCO Collected (This Month)"
              value={kpiData.currentMonth.uco.toFixed(2)}
              unit="L"
              changePct={kpiData.changePct}
              icon={FaOilCan}
              color="#10B981"
              sparkData={monthlyTrends.map(d => ({ value: d.uco }))}
            />
            <KpiCard
              title="CO2 Offset (This Month)"
              value={kpiData.currentMonth.co2.toFixed(2)}
              unit="kg"
              changePct={kpiData.changePct}
              icon={FaLeaf}
              color="#3B82F6"
              sparkData={monthlyTrends.map(d => ({ value: d.co2 }))}
            />
            <KpiCard
              title="Water Saved (This Month)"
              value={(kpiData.currentMonth.water / 1_000_000).toFixed(2)}
              unit="M L"
              changePct={kpiData.changePct}
              icon={FaWater}
              color="#06B6D4"
              sparkData={monthlyTrends.map(d => ({ value: d.water }))}
            />
          </div>

          {/* Chart + controls */}
          {monthlyTrends.length > 0 && (
            <div className="kpi-chart" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

              {/* Chart area */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>Monthly Impact Trend</h3>
                  {allMonths.length > 0 && (
                    <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>
                      {allMonths[fromIdx]} → {allMonths[toIdx] || allMonths[allMonths.length - 1]}
                      &nbsp;·&nbsp;{visibleTrends.length} month{visibleTrends.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {visibleTrends.length === 0 ? (
                  <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    No data for selected range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={380}>
                    <LineChart data={visibleTrends}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      {SERIES.filter(s => activeSeries.includes(s.key)).map(s => (
                        <Line
                          key={s.key}
                          yAxisId="left"
                          dataKey={s.dataKey}
                          stroke={s.color}
                          name={s.label}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Controls sidebar */}
              {allMonths.length > 0 && (
                <ChartControls
                  allMonths={allMonths}
                  fromIdx={fromIdx}
                  toIdx={toIdx === 0 && allMonths.length > 1 ? allMonths.length - 1 : toIdx}
                  onFromChange={(i) => { setFromIdx(i); if (i > toIdx) setToIdx(i); }}
                  onToChange={(i) => { setToIdx(i); if (i < fromIdx) setFromIdx(i); }}
                  activeSeries={activeSeries}
                  onToggleSeries={handleToggleSeries}
                />
              )}
            </div>
          )}

          <p className="kpi-footnote">
            CO2 savings calculated at ≈2.5 kg per litre recycled UCO (Malaysia B20/NETR basis).
            Water protection ≈1 million litres per litre prevented from pollution.
          </p>
        </section>
      </div>

      <div className="bottomTag">@EcoMate</div>
    </div>
  );
}

export default Dashboard;