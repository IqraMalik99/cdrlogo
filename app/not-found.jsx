"use client";

import { useEffect, useState } from "react";

export default function NotFound() {
  const [message, setMessage] = useState(
    "The page you are looking for does not exist."
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/site-setting`,
          { cache: "no-store" }
        );

      
          const data = await res.json();
          console.log("Fetched site settings:", data);
            setMessage(data.MaintanceMessage);
          
          
        
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const styles = {
    wrapper: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0f1117",
      color: "#e2e8f0",
      fontFamily: "'DM Sans', sans-serif",
      padding: 20,
    },

    card: {
      maxWidth: 520,
      width: "100%",
      padding: "40px 32px",
      borderRadius: 16,
      background: "#131720",
      border: "1px solid #1e2535",
      textAlign: "center",
    },

    icon: {
      fontSize: 42,
      marginBottom: 10,
    },

    title: {
      fontSize: 22,
      fontWeight: 700,
      marginBottom: 10,
    },

    message: {
      fontSize: 14,
      color: "#94a3b8",
      lineHeight: 1.6,
      marginBottom: 10,
    },

    sub: {
      fontSize: 12,
      color: "#64748b",
      marginBottom: 20,
    },

    button: {
      display: "inline-block",
      padding: "10px 16px",
      borderRadius: 10,
      background: "#22c55e",
      color: "#fff",
      textDecoration: "none",
      fontSize: 13,
      fontWeight: 600,
    },

    loadingText: {
      fontSize: 16,
      color: "#94a3b8",
    },
  };

  // ── Loading UI ──
  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.icon}>⏳</div>
          <p style={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.icon}>⚠️</div>

        <h1 style={styles.title}>Page Not Found</h1>

        <p style={styles.message}>{message}</p>

        <p style={styles.sub}>
          Please check the URL or return to homepage.
        </p>

        <a href="/" style={styles.button}>
          Go Home
        </a>
      </div>
    </div>
  );
}