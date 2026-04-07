

import supabase from "../supabaseClient";

import React, { useState } from "react";
import "./login.css";
import { useNavigate } from "react-router-dom";

import companyLogo from "./logo.png";

function Login() {
  const [username, setUsername] = useState(""); // username = email
  const [password, setPassword] = useState("");
  const [error1, seterror1] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
  e.preventDefault();
  seterror1("");

  const Email = username.trim().toLowerCase();

  if (!Email || !password) {
    seterror1("Please enter your email and password.");
    return;
  }

  setLoading(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: Email,
      password,
    });

    if (error) {
      seterror1(error.message);
      return;
    }

    if (!data?.session) {
      seterror1("Login failed. Please try again.");
      return;
    }

    const uid = data.session.user.id;

    const { data: profile, error: profErr } = await supabase
      .from("users")
      .select("role, must_change_password")
      .eq("user_id", uid)
      .maybeSingle();

    if (profErr || !profile) {
      await supabase.auth.signOut();
      seterror1("No profile found for this account.");
      return;
    }
    console.log("ROLE FROM DB:", profile.role);

    const allowedRoles = ["admin"];
    if (!allowedRoles.includes(profile.role)) {
      await supabase.auth.signOut();
      seterror1("Not authorised (admin only)");
      return;
    }

    console.log("PROFILE:", profile);
console.log("must_change_password:", profile?.must_change_password);



if (profile.must_change_password) {
  navigate("/login2");
  return;
} else{
  navigate("/dashboard");
}








  } catch (err) {
    seterror1(err?.message || "Something went wrong.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="website-container">
     
      <div className="login-head">
        <img   
          src={companyLogo}
          alt="Company Logo"
          className="logo-image"
        />
        <h1>EcoMate Admin Website</h1>
       
      </div>

      <div className="loginbox">
        <form onSubmit={handleLogin}>
          <div className="input-container">
             <h2>Sign in</h2>
            <label className="label">Email ID</label>
            <input
              type="text"
              className="input-field0"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="input-container">
            <label className="label">Password</label>
            <input
              type="password"
              className="input-field0"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error1 && <p className="error-message">{error1}</p>}

          <button
            type="submit"
            className="login-button"
            disabled={loading}     
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

         <button
  type="button"
  className="forgot-password"
  onClick={() => {
    console.log("navigating...");
    navigate("/forgotpass");
  }}
>
  Forgot Password
</button>

        </form>
      </div>

       <div className="bottomTag">@EcoMate</div>
    </div>
  );
}

export default Login;
