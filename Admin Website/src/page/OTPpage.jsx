import React, { useState,useEffect,useRef  } from "react";
import "./login.css";
import { useNavigate } from "react-router-dom";
import companyLogo from "./logo.png";
import supabase from "../supabaseClient"; 

function Login02() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error2, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
const [otpMsg, setOtpMsg] = useState("");
const [otpVerified, setOtpVerified] = useState(false);
const [sendingOtp, setSendingOtp] = useState(false);
const [verifyingOtp, setVerifyingOtp] = useState(false);
const [cooldown, setCooldown] = useState(300);
const [canResend, setCanResend] = useState(false);
const [resendCount, setResendCount] = useState(0);
const MAX_RESENDS = 2;

  const navigate = useNavigate();
const sentOnceRef = useRef(false);

  useEffect(() => {
    if (sentOnceRef.current) return;
    sentOnceRef.current = true;

    const sendOtpNow = async () => {
      setOtpMsg("");
      setError("");
      setOtpVerified(false);

      setSendingOtp(true);
      try {
      
        const { data, error: userErr } = await supabase.auth.getUser();
        const email = data?.user?.email;

        if (userErr || !email) {
          setError("Session expired. Please log in again.");
          navigate("/login", { replace: true });
          return;
        }

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ email }),
          }
        );

        const text = await res.text();
        console.log("send-otp status:", res.status);
        console.log("send-otp body:", text);

        let json = null;
        try {
          json = JSON.parse(text);
        } catch (_) {}

        if (!res.ok) throw new Error(json?.error || text || "Failed to send OTP");

        setOtpMsg(`OTP sent to ${email}. Check your inbox.`);
      } catch (e) {
        setError(e?.message || "Failed to send OTP.");
      } finally {
        setSendingOtp(false);
      }
    };

    sendOtpNow();
  }, [navigate]);


useEffect(() => {
  if (cooldown <= 0) {
    setCanResend(true);
    return;
  }

  const timer = setInterval(() => {
    setCooldown((prev) => prev - 1);
  }, 1000);

  return () => clearInterval(timer);
}, [cooldown]);



  const handleVerifyOtp = async () => {
    setError("");
    setOtpMsg("");

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    setVerifyingOtp(true);

    try {
      
      const { data, error: userErr } = await supabase.auth.getUser();
      const email = data?.user?.email;

      if (userErr || !email) {
        setError("Session expired. Please log in again.");
        navigate("/login", { replace: true });
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email, otp: cleanOtp }),
        }
      );

      const text = await res.text();
      console.log("verify-otp status:", res.status);
      console.log("verify-otp body:", text);

      let json = null;
      try {
        json = JSON.parse(text);
      } catch (_) {}

      if (!res.ok) throw new Error(json?.error || text || "OTP verification failed");

      setOtpVerified(true);

      
      navigate("/login3", { replace: true }, { state: { mode: "firstLogin" } });

    } catch (e) {
      setError(e?.message || "OTP verification failed.");
    } finally {
      setVerifyingOtp(false);
    }
  }


const handleResendOtp = async () => {
  if (!canResend) return;

  if (resendCount >= MAX_RESENDS) {
    setError("Maximum OTP requests reached. Please login again.");
    return;
  }

  setSendingOtp(true);
  setError("");
  setOtpMsg("");

  try {
    const { data, error: userErr } = await supabase.auth.getUser();
    const email = data?.user?.email;

    if (userErr || !email) {
      setError("Session expired. Please log in again.");
      navigate("/login", { replace: true });
      return;
    }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email }),
      }
    );

    if (!res.ok) throw new Error("Failed to resend OTP");

    setOtpMsg("New OTP sent.");

   
    setResendCount(prev => prev + 1);

    setCooldown(300);
    setCanResend(false);

  } catch (e) {
    setError(e.message);
  } finally {
    setSendingOtp(false);
  }
};


  return (
     <div className="website-container">
      <div className="login-head">
        <img src={companyLogo} alt="Company Logo" className="logo-image" />
        <h1>EcoMate Admin website</h1>

        <h3 className="password-warning">Welcome to the EcoMate Team!</h3>

        <h4 className="password-warning2">
          *As a first-time user, you are required to change your password before continuing.
        </h4>
      </div>

      <div className="loginbox2">
        <div className="input-container2">
          <label className="label">Enter OTP (6-digit code)</label>
          <input
            type="text"
            className="input-field0"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            disabled={otpVerified}
          />

          <button
            type="button"
            className="login-button"
            onClick={handleVerifyOtp}
            disabled={verifyingOtp || otpVerified}
            style={{ marginTop: 12 }}
          >
            {otpVerified ? "Verified ✅" : verifyingOtp ? "Verifying..." : "Verify OTP"}
          </button>

          {sendingOtp && <p style={{ marginTop: 10 }}>Sending OTP...</p>}
        {otpMsg && (
  <p style={{ marginTop: 10, color: "#ffffff" }}>
    {otpMsg}
  </p>
)}
          {error2 && <p className="error-message">{error2}</p>}

        </div>


        <label
  type="button"
  className="login-button"
  onClick={handleResendOtp}
  disabled={!canResend}
  style={{ marginTop: 10 }}
>
  {canResend
    ? "Resend OTP"
    : `Resend available in ${Math.floor(cooldown / 60)}:${String(
        cooldown % 60
      ).padStart(2, "0")}`}
</label>



      </div>

      <div className="bottomTag1">@EcoMate</div>
    </div>
  );
}

export default Login02;