"use client";

import React, { useEffect, useState } from "react";

declare global {
  interface Window {
    PaystackPop: any;
  }
}

const Wallet: React.FC = () => {
  const [currency, setCurrency] = useState<"USDT" | "NGN">("NGN");
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Static fallback rate (you can replace with API later)
  const USDT_RATE = 1500;

  const usdtAmount =
    currency === "USDT" ? Number(amount) : Number(amount) / USDT_RATE;

  const nairaEquivalent = usdtAmount * USDT_RATE;

  const payWithPaystack = () => {
    if (!email) return alert("Enter email");
    if (!amount || Number(amount) <= 0) return alert("Enter valid amount");
    if (!window.PaystackPop) return alert("Paystack not loaded");

    setLoading(true);

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email,
      amount: Math.round(nairaEquivalent * 100),
      currency: "NGN",
      ref: `order_${Date.now()}`,
      callback: function (resp: { reference: string }) {
        fetch("/api/paystack/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference: resp.reference,
            email,
            amount: nairaEquivalent,
          }),
        })
          .then(() => {
            setMessage("Payment successful 🎉");
          })
          .catch(() => {
            setMessage("Payment received but verification failed");
          })
          .finally(() => setLoading(false));
      },
      onClose: function () {
        setLoading(false);
        alert("Payment cancelled");
      },
    });

    handler.openIframe();
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "40px auto",
        padding: 20,
        borderRadius: 12,
        background: "#f9fafb",
      }}
    >
      <h2>Pay with Paystack</h2>

      <label>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <label>Currency</label>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as any)}
        style={{ width: "100%", marginBottom: 10 }}
      >
        <option value="NGN">NGN</option>
        <option value="USDT">USDT</option>
      </select>

      <label>Amount ({currency})</label>
      <input
        type="number"
        min="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <p>USDT Equivalent: {usdtAmount.toFixed(4)}</p>
      <p>NGN Equivalent: ₦{Math.round(nairaEquivalent)}</p>

      <button
        onClick={payWithPaystack}
        disabled={loading}
        style={{
          width: "100%",
          padding: 10,
          marginTop: 10,
          background: "#16a34a",
          color: "#fff",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        {loading ? "Processing..." : "Pay with Paystack"}
      </button>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
};

export default Wallet;
