"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import useUser from "@/hooks/useUser";

export default function SignOutPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { updateUser } = useUser();

  useEffect(() => {
    const signOutApi = async () => {
      try {
        const response = await fetch(`/api/logout`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to log out from the backend");
        }

        // Prefer runtime-config injected at container start, then fall back to env
        const rc = (globalThis as any)?.__RUNTIME_CONFIG__;
        const headerAuthEnabled = rc && rc.HEADER_AUTH_ENABLED !== undefined
          ? ["1", "true", "yes"].includes(String(rc.HEADER_AUTH_ENABLED).toLowerCase())
          : ((process.env.NEXT_PUBLIC_HEADER_AUTH_ENABLED ?? process.env.HEADER_AUTH_ENABLED ?? "false").toString().toLowerCase() in ["1", "true", "yes"]);
        const externalLogoutUrl = rc?.HEADER_AUTH_LOGOUT_URL ?? process.env.NEXT_PUBLIC_HEADER_AUTH_LOGOUT_URL ?? process.env.HEADER_AUTH_LOGOUT_URL ?? "";

        // Clear NextAuth session and local state first
        await signOut({ redirect: false });
        updateUser({});

        if (headerAuthEnabled && externalLogoutUrl) {
          // Redirect user to the identity provider end-session URL
          window.location.href = externalLogoutUrl;
          return;
        }

        // Fallback to home
        window.location.href = "/";
      } catch (err) {
        console.error("Error during sign-out API call:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    signOutApi();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h1>Signing you out...</h1>
        <p>Please wait while we log you out.</p>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h1>Failed to sign you out</h1>
        <p>{error}</p>
      </div>
    );
  }

  return null;
}
