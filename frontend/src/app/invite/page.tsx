"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, Check, X, Loader2, LogOut } from "lucide-react";
import { apiFetch, getToken, clearToken } from "@/lib/auth";

function InviteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "wrong-account">("loading");
  const [message, setMessage] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid invite link — no token provided.");
      return;
    }

    // If not logged in, redirect to login with a return URL
    if (!getToken()) {
      const returnUrl = `/invite?token=${encodeURIComponent(token)}`;
      router.replace(`/login?next=${encodeURIComponent(returnUrl)}`);
      return;
    }

    // Accept the invite
    (async () => {
      try {
        const res = await apiFetch("/api/v1/team/accept-invite", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => null);

        if (res.ok) {
          setStatus("success");
          setWorkspaceName(data?.workspace_name || "the workspace");
          setMessage(
            data?.status === "already_member"
              ? "You're already a member of this workspace."
              : `You've joined ${data?.workspace_name || "the workspace"} as ${data?.role || "a member"}.`
          );
          // Redirect to dashboard after a short delay
          setTimeout(() => router.push("/app"), 2000);
        } else if (
          res.status === 403 &&
          data?.detail?.toLowerCase().includes("different email")
        ) {
          // Logged in as the wrong account — offer to switch
          setStatus("wrong-account");
          setMessage(
            "You're signed in with a different account than the one this invite was sent to. " +
            "Sign out and log in with the invited email address to accept."
          );
        } else {
          setStatus("error");
          setMessage(data?.detail || "Failed to accept invite.");
        }
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    })();
  }, [token, router]);

  function handleSwitchAccount() {
    // Log out, then redirect to login with this invite page as the return URL
    clearToken();
    const returnUrl = `/invite?token=${encodeURIComponent(token || "")}`;
    router.replace(`/login?next=${encodeURIComponent(returnUrl)}`);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--n25, #f8f9fb)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: "40px 48px",
        border: "1px solid #e4e7ec", maxWidth: 440, width: "100%",
        textAlign: "center",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12, margin: "0 auto 20px",
          background: status === "success"
            ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
            : status === "wrong-account"
            ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            : status === "error"
            ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
            : "linear-gradient(135deg, #0C66E4 0%, #08458C 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {status === "loading" && <Loader2 size={24} color="#fff" className="spin" />}
          {status === "success" && <Check size={24} color="#fff" />}
          {status === "wrong-account" && <LogOut size={24} color="#fff" />}
          {status === "error" && <X size={24} color="#fff" />}
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#091E42", margin: "0 0 8px" }}>
          {status === "loading" && "Accepting invite..."}
          {status === "success" && "Welcome to the team!"}
          {status === "wrong-account" && "Wrong account"}
          {status === "error" && "Invite failed"}
        </h1>

        <p style={{ fontSize: 14, color: "#626F86", lineHeight: 1.6, margin: "0 0 24px" }}>
          {message}
        </p>

        {status === "success" && (
          <p style={{ fontSize: 13, color: "#8590A2" }}>
            Redirecting to dashboard...
          </p>
        )}

        {status === "wrong-account" && (
          <button
            onClick={handleSwitchAccount}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 6, fontSize: 13,
              fontWeight: 600, cursor: "pointer", border: "none",
              background: "#0C66E4", color: "#fff",
            }}
          >
            <LogOut size={14} />
            Sign out & switch account
          </button>
        )}

        {status === "error" && (
          <button
            onClick={() => router.push("/app")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 6, fontSize: 13,
              fontWeight: 600, cursor: "pointer", border: "none",
              background: "#0C66E4", color: "#fff",
            }}
          >
            Go to dashboard
          </button>
        )}
      </div>
    </div>
  );
}

// `useSearchParams()` forces client-side rendering, so Next.js 15 requires the
// component that calls it to sit inside a Suspense boundary — otherwise the
// static prerender of /invite fails the production build.
export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteContent />
    </Suspense>
  );
}
