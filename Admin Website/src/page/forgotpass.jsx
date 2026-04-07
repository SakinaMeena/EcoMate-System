import React, { useState } from "react";
import companyLogo from "./logo.png";
import "./login.css";
import supabase from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import "./login.css";

function ForgotPass() {

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  
  const verifyEmail = async () => {

  setError("");
  setMessage("");

  if (!email) {
    setError("Please enter your email");
    return;
  }

  const { data, error } = await supabase
    .from("users")
    .select("email,role")
    .eq("email", email)
    .single();

  if (error || !data) {
    setError("Email address does not exist");
    return;
  }

  const role = data.role;

  if (
    role !== "admin"
  ) {
    setError("Invalid email address");
    return;
  }


  setMessage("Email verified. Sending OTP...");
  await sendOtp();

};
const sendOtp = async () => {
  try {

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email })
      }
    );

    const result = await res.json();

    if (!res.ok) {
      setError(result.error || "Failed to send OTP");
      return;
    }

    setMessage("Please check your email for the OTP.");
    setOtpSent(true);

  } catch (err) {
    setError("Failed to contact server");
  }
};





  return (
    <div className="forgotpass-container">

     
      <div className="login-head">
        <img
          src={companyLogo}
          alt="Company Logo"
          className="logo-image"
        />
        <h1>EcoMate Admin Website</h1>
      </div>

     
      <div className="loginbox5">

        <h2 className="reset-title">Reset Password</h2>

        <div className="input-container">
          <label className="label">Email ID</label>

          <input
          type="email"
          className="input-field0"
          placeholder="Enter your email"
          value={email}
          disabled={otpSent}
          onChange={(e) => setEmail(e.target.value)}
         />

        </div>

        <button
          className="verify-btn"
          onClick={verifyEmail}
     >
         Verify Email
         </button>

       {error && <p style={{color:"red"}}>{error}</p>}
       {message && <p style={{color:"white"}}>{message}</p>}

       {otpSent && (
  <div className="input-container">

    <label className="label">Enter OTP</label>

    <input
      type="text"
      className="input-field0"
      placeholder="Enter 6-digit OTP"
      value={otp}
      onChange={(e) => setOtp(e.target.value)}
    />

    <button className="verify-btn"
        onClick={() => navigate("/login3", { state: { mode: "resetPassword" } })}
    >
      Verify OTP
    </button>

  </div>
)}


 </div>

  <div className="bottomTag">@EcoMate</div>
    </div>
  );
}

export default ForgotPass;