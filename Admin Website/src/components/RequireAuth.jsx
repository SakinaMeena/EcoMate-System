import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import supabase from "../supabaseClient";

export default function RequireAdmin() {
  const [state, setState] = useState("loading"); 

  useEffect(() => {
    let alive = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (!session) {
        if (alive) setState("nope");
        return;
      }

      const email = session.user.email;

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("email", email)
        .maybeSingle();

      const allowedRoles = ["admin"];
      if (!profile || !allowedRoles.includes(profile.role)) {
        if (alive) setState("nope");
        return;
      }

      if (alive) setState("ok");
    };

    check();
    return () => {
      alive = false;
    };
  }, []);

  if (state === "loading") return null;
  if (state === "nope") return <Navigate to="/" replace />;

  return <Outlet />;
}