"use client";

import React, { useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import type { ConnectedWallet } from "@tonconnect/ui";
import { PaystackButton } from "react-paystack";

/**
 * SIDE NOTES:
 * - Backend logic is USDT-only
 * - Frontend uses Paystack public key
 * - UI can show NGN or USDT
 * - Wallet balance is recorded server-side and persists after refresh
 * - Paystack payment opens modal inline, avoids fullscreen warnings
 */

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

  // ==== Pay with USDT via TON (backend handles Jetton payload) ====
  const payWithUsdtTon = async () => {
    if (!tc || !walletAddress || !usdtAmount) return;

    setLoading(true);
    setMessage("");

    try {
      // 1️⃣ Init USDT order on backend
      const res = await fetch("/api/usdt/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, usdtAmount }),
      });
      const { orderId, jettonWallet } = await res.json();

      // 2️⃣ Ask TON Connect to send transaction
      await tc.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: jettonWallet,
            amount: "50000000", // gas in nanotons
            payload: "", // actual payload built on backend
          },
        ],
      });

      setMessage("USDT transaction sent");

      // 3️⃣ Poll backend for confirmation
      const interval = setInterval(async () => {
        const r = await fetch("/api/usdt/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const d = await r.json();
        if (d.status === "paid") {
          clearInterval(interval);
          fetchBalance();
          setMessage("USDT payment confirmed");
        }
      }, 4000);
    } catch (e) {
      console.error(e);
      setMessage("USDT payment failed");
    } finally {
      setLoading(false);
    }
  };

  // ===== Connect Wallet =====
  const connectTonWallet = async () => {
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

  // ===== Paystack Config =====
  const paystackConfig = {
    email,
    amount: Math.round(nairaEquivalent * 100),
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
    currency: "NGN",
    onSuccess: async (resp: any) => {
      if (!walletAddress) return alert("Connect TON wallet first");

      const res = await fetch("/api/link-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: resp.reference, wallet: walletAddress }),
      });
      const data = await res.json();
      if (data.status === "wallet_linked") {
        alert("Payment successful & balance updated!");
        fetchBalance();
      }
    },
    onClose: () => alert("Payment cancelled"),
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
          {connected ? walletAddress : "Not connected"}
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
        placeholder="Email for Paystack"
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
        <button
          onClick={payWithUsdtTon}
          disabled={loading || !connected}
          style={{ marginTop: 10 }}
        >
          Pay with USDT (TON)
        </button>
      ) : (
        <button onClick={connectTonWallet} style={{ marginTop: 10 }}>
          Connect TON Wallet
        </button>
      )}

      <hr style={{ margin: "20px 0" }} />

      {email && amount && <PaystackButton {...paystackConfig} text="Pay with Paystack" />}

      {message && <p>{message}</p>}
      {walletWarning && <p style={{ color: "red" }}>{walletWarning}</p>}
    </div>
  );
};

export default Wallet;
