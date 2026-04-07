
import "./profile.css";
import supabase from "../supabaseClient";
import React, { useEffect, useState } from "react";

function ProfilePanel({ open, onClose, profile,onProfileUpdate }) {
 
  const [view, setView] = useState("menu"); 
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passError, setPassError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [phoneDraft, setPhoneDraft] = useState(profile?.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  

  

useEffect(() => {
  setPhoneDraft(profile?.phone ?? "");
  setIsEditingPhone(false); 
}, [profile, open]);

  


  if (!open) return null;


  const handleUpdatePassword = async () => {
  setPassError("");
  setSuccessMsg("");

  if (!newPassword || !confirmPassword) {
    setPassError("Please fill in both password fields.");
    return;
  }

  if (newPassword.length < 6) {
    setPassError("Password must be at least 6 characters.");
    return;
  }

  if (newPassword !== confirmPassword) {
    setPassError("Passwords do not match.");
    return;
  }
   
  setSavingPassword(true);

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  setSavingPassword(false);

  if (error) {
    setPassError(error.message);
    return;
  }

  setNewPassword("");
  setConfirmPassword("");
  setSuccessMsg("Password updated successfully.");
};


const handleSavePhone = async () => {
  setPhoneErr("");
  setPhoneMsg("");

  onProfileUpdate?.({ phone: phoneDraft.trim() }); 
setIsEditingPhone(false);
  
  if (!phoneDraft.trim()) {
    setPhoneErr("Phone number cannot be empty.");
    return;
  }

  setSavingPhone(true);

  
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = authData?.user;

  if (authErr || !user) {
    setSavingPhone(false);
    setPhoneErr("Session expired. Please log in again.");
    return;
  }

  const { error } = await supabase
    .from("users")
    .update({ phone: phoneDraft.trim() })
    .eq("user_id", user.id);

  setSavingPhone(false);

  if (error) {
    setPhoneErr(error.message);
    return;
  }

  setPhoneMsg("Phone number updated.");
  setIsEditingPhone(false);
};




  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-panel" onClick={(e) => e.stopPropagation()}>

        <div className="profile-header">
          <h3>Profile</h3>

          <button className="profile-close" onClick={onClose}>
            ✕
          </button>
        </div>

       
        {view === "menu" && (
          <>
            <div className="profile-body">
              <h1>Account</h1>

              <button onClick={() => setView("info")}>
                Profile info
              </button>

               <button onClick={() => setView("change_password")}>
                Change password
              </button>
            </div>

          
          </>
        )}

        {/*  PROFILE INFO VIEW */}
        {view === "info" && (
          <div className="profile-body">

            <button 
              className="profile-back"
              onClick={() => setView("menu")}
            >
              ← Back
            </button>

            <h1>Profile Info</h1>

            <div className="profile-row">
              <span>Name</span>
              <span> {profile?.name ?? "-"}</span>
            </div>

     
<div className="profile-row editable-row">
  <span>Phone number</span>

  {!isEditingPhone ? (
    <div className="phone-view">
      <span className="phone-text">{profile?.phone ?? "-"}</span>

      <button
        type="button"
        className="phone-edit-btn"
        onClick={() => setIsEditingPhone(true)}
      >
        Edit
      </button>
    </div>
  ) : (
    <div className="phone-edit">
      <input
        className="phone-input"
        value={phoneDraft}
        onChange={(e) => setPhoneDraft(e.target.value)}
        placeholder="Enter phone number"
      />

      <button
        className="phone-save"
        type="button"
        onClick={handleSavePhone}
        disabled={savingPhone}
      >
        {savingPhone ? "Saving..." : "Save"}
      </button>

      <button
        className="phone-cancel"
        type="button"
        onClick={() => {
          setPhoneDraft(profile?.phone ?? "");
          setIsEditingPhone(false);
        }}
      >
        Cancel
      </button>
    </div>
  )}
</div>
            

            <div className="profile-row">
              <span>Email</span>
              <span>{profile?.email ?? "-"}</span>
            </div>

          </div>
        )}




        {view === "change_password" && (
  <div className="profile-body">

    <button 
      className="profile-back"
      onClick={() => setView("menu")}
    >
      ← Back
    </button>

    <h1>Change Password</h1>

    <label className="profile-field">
      New password
      <input
        type="password"
        className="input-field3"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
    </label>

    <label className="profile-field">
      Confirm password
      <input
        type="password"
        className="input-field3"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
    </label>

    {passError && <p className="profile-error">{passError}</p>}
    {successMsg && <p className="profile-success">{successMsg}</p>}

    <button 
      className="profile-primary"
      onClick={handleUpdatePassword}
      disabled={savingPassword}
    >
      {savingPassword ? "Updating..." : "Update Password"}
    </button>

  </div>
)}





        




      </div>
    </div>
  );
}

export default ProfilePanel;