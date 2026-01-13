"use client";

import React, { useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import type { ConnectedWallet } from "@tonconnect/ui";

/**
 * SIDE NOTES:
 * - Paystack payment does NOT require wallet connection
 * - USDT payment requires wallet connection
 * - Wallet balance persists after refresh
 * - Paystack opens inline modal
 */

declare global {
  interface Window {
    PaystackPop: any;
  }
}

const Wallet: React.FC = () => {
  const [tc, setTc] = useState<TonConnectUI | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [connected, setConnected] = useState(false);

  const [currency, setCurrency] = useState<"USDT" | "NGN">("USDT");
  const [amount, setAmount] = useState("");
  const [usdtPrice, setUsdtPrice] = useState(1500);
  const [email, setEmail] = useState("");

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [walletWarning, setWalletWarning] = useState("");

  // ===== TON Connect Init =====
  useEffect(() => {
    const ui = new TonConnectUI({
      manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
    });
    setTc(ui);

    ui.onStatusChange((wallet: ConnectedWallet | null) => {
      if (wallet) {
        setConnected(true);
        setWalletAddress(wallet.account.address);
        setWalletWarning("");
      } else {
        setConnected(false);
        setWalletAddress("");
        setWalletBalance(0);
      }
    });
  }, []);

  // ===== Fetch USDT Price =====
  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then((res) => res.json())
      .then((data) => setUsdtPrice(Math.round(data.rates.NGN)))
      .catch(() => setUsdtPrice(1500));
  }, []);

  // ===== Wallet Balance =====
  const fetchBalance = async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/balance/${walletAddress}`);
      const data = await res.json();
      setWalletBalance(Number(data.usdt_balance) || 0);
    } catch {
      setWalletBalance(0);
    }
  };
  useEffect(() => {
    fetchBalance();
  }, [walletAddress]);

  const usdtAmount =
    currency === "USDT" ? Number(amount) : Number(amount) / usdtPrice;
  const nairaEquivalent = usdtAmount * usdtPrice;

  // ===== USDT Payment (Production-ready) =====
  const payWithUsdtTon = async () => {
  if (!tc || !walletAddress) {
    setWalletWarning("Connect TON wallet first");
    return;
  }

  if (!amount || Number(amount) <= 0) {
    setWalletWarning("Enter a valid amount");
    return;
  }

  setLoading(true);
  setMessage("Opening wallet for approval...");

  try {
    // 1️⃣ Init backend
    const res = await fetch("/api/usdt/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: walletAddress,
        usdtAmount
      })
    });

    const { orderId, jettonWallet, payload } = await res.json();

    // 2️⃣ Send TX (THIS OPENS WALLET)
    await tc.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [
        {
          address: jettonWallet,
          amount: "1", // 🔥 ONLY GAS
          payload // 🔥 BASE64 PAYLOAD
        }
      ]
    });

    setMessage("Transaction sent. Waiting for confirmation...");

    // 3️⃣ Poll confirmation
    const interval = setInterval(async () => {
      const r = await fetch("/api/usdt/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId })
      });

      const d = await r.json();

      if (d.status === "paid") {
        clearInterval(interval);
        fetchBalance();
        setMessage("USDT payment confirmed!");
      }
    }, 4000);
  } catch (e) {
    console.error("TON transaction failed:", e);
    setMessage("Transaction cancelled or failed");
  } finally {
    setLoading(false);
  }
};

  // ===== Connect TON Wallet =====
  const connectTonWallet = async () => {
    if (connected) {
      alert("Wallet already connected");
      return;
    }
    if (!tc) return;

    try {
      const wallet: ConnectedWallet = await (tc as any).connectWallet();
      if (wallet) {
        setConnected(true);
        setWalletAddress(wallet.account.address);
      }
    } catch {
      setWalletWarning("Failed to connect wallet");
    }
  };

  // ===== Disconnect TON Wallet =====
  const disconnectTonWallet = async () => {
    if (!tc) return;
    try {
      await tc.disconnect();
      setConnected(false);
      setWalletAddress("");
      setWalletBalance(0);
      setWalletWarning("");
      setMessage("");
    } catch {
      setWalletWarning("Failed to disconnect wallet");
    }
  };

  // ===== PAYSTACK INLINE =====
  const payWithPaystack = () => {
    if (!email) return alert("Enter email");
    if (!window.PaystackPop) return alert("Paystack not loaded");

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
            wallet: walletAddress || null,
          }),
        })
          .then(() => {
            setMessage(
              walletAddress
                ? "Payment successful & wallet credited!"
                : "Payment successful. Connect wallet to receive USDT."
            );
            if (walletAddress) fetchBalance();
          })
          .catch(() => {
            setMessage("Payment received but verification failed");
          });
      },
      onClose: function () {
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
      <h2>Wallet & Payment</h2>

      <div
        style={{
          background: "#eef2ff",
          padding: 12,
          borderRadius: 8,
          marginBottom: 14,
          fontSize: 13,
        }}
      >
        <p>
          <strong>Wallet Address:</strong>{" "}
          {connected ? (
            <>
              {walletAddress.slice(0, 5)}...
              <button
                onClick={disconnectTonWallet}
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  padding: "0 4px",
                  minWidth: 16,
                  height: 16,
                  background: "#f87171",
                  color: "#fff",
                  borderRadius: 4,
                  cursor: "pointer",
                  lineHeight: "16px",
                  textAlign: "center",
                }}
              >
                x
              </button>
            </>
          ) : (
            "Not connected"
          )}
        </p>
        <p>
          <strong>Wallet Balance:</strong>{" "}
          {connected ? `${walletBalance.toFixed(4)} USDT` : "0.0000 USDT"}
        </p>
      </div>

      <label>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label>Currency</label>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as any)}
      >
        <option value="USDT">USDT</option>
        <option value="NGN">NGN</option>
      </select>

      <label>Amount ({currency})</label>
      <input
        type="number"
        min="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <p>USDT Equivalent: {usdtAmount.toFixed(4)}</p>
      <p>NGN Equivalent: ₦{Math.round(nairaEquivalent)}</p>

      {connected ? (
        <button onClick={payWithUsdtTon} disabled={loading}>
          {loading ? "Awaiting wallet approval..." : "Pay with USDT (TON)"}
        </button>
      ) : (
        <button onClick={connectTonWallet}>Connect TON Wallet</button>
      )}

      <hr style={{ margin: "20px 0" }} />

      <button onClick={payWithPaystack}>Pay with Paystack</button>

      {!walletAddress && (
        <p style={{ color: "#555", fontSize: 13 }}>
          Connect wallet later to receive USDT.
        </p>
      )}

      {message && <p>{message}</p>}
      {walletWarning && <p style={{ color: "red" }}>{walletWarning}</p>}
    </div>
  );
};

export default Wallet;
