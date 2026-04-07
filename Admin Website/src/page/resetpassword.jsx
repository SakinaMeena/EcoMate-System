import React, { useState } from "react";
import "./login.css";
import { useNavigate, useLocation } from "react-router-dom";
import companyLogo from "./logo.png";
import supabase from "../supabaseClient";

function Login03() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error2, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const mode = location.state?.mode || "resetPassword";
  const navigate = useNavigate();

  const handleLogin3 = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      setError(
        "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match, please try again.");
      return;
    }

    setLoading(true);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      setLoading(false);
      setError("Session expired. Please log in again.");
      navigate("/", { replace: true });
      return;
    }

    const { error: passErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (passErr) {
      setLoading(false);
      setError(passErr.message);
      return;
    }

    const { error: flagErr } = await supabase
      .from("users")
      .update({ must_change_password: false })
      .eq("user_id", user.id);

    if (flagErr) {
      setLoading(false);
      setError(
        "Password changed, but failed to update in the system. Please contact admin."
      );
      return;
    }

    setLoading(false);
    setSuccessMessage(
      "Password changed successfully. Please return to the main login page and log in again."
    );
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="website-container">
      <div className="login-head">
        <img src={companyLogo} alt="Company Logo" className="logo-image" />
        <h1>EcoMate Admin website</h1>

        {mode === "firstLogin" && (
          <>
            <h3 className="password-warning">Welcome to the EcoMate Team!</h3>
            <h4 className="password-warning2">
              *As a first-time user, you are required to change your password
              before continuing.
            </h4>
          </>
        )}

        {mode === "resetPassword" && (
          <h3 className="password-warning">
            Please create a new password to access your account.
          </h3>
        )}
      </div>

      <div className="loginbox3">
        {!successMessage ? (
          <form onSubmit={handleLogin3}>
            <div className="input-container2">
              <label className="label">Enter your new password</label>
              <input
                type="password"
                className="input-field0"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="input-container">
              <label className="label">Re-enter your password</label>
              <input
                type="password"
                className="input-field0"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error2 && <p className="error-message">{error2}</p>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading
                ? "Updating..."
                : mode === "firstLogin"
                ? "Set password"
                : "Reset password"}
            </button>
          </form>
        ) : (
          <div className="success-box">
            <p className="success-message">{successMessage}</p>
            <button
              type="button"
              className="login-button"
              onClick={() => navigate("/", { replace: true })}
            >
              Back to Main Login
            </button>
          </div>
        )}
      </div>

      <div className="security_Warning">
        <h3>
          For security purposes, please choose a strong password and avoid using
          personal information such as birthdays, names or anniversaries.
        </h3>
      </div>
    </div>
  );
}

export default Login03;