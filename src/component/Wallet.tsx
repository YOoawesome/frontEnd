import React, { useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import type { ConnectedWallet } from "@tonconnect/ui";

/**
 * SIDE NOTE:
 * - Backend logic is USDT-only
 * - UI can show NGN or USDT
 * - Wallet balance is recorded server-side and persists after refresh
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

  const [paystackReference, setPaystackReference] = useState<string | null>(null);

  // ===== INIT TON CONNECT =====
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

  // ===== FETCH USDT PRICE =====
  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then((res) => res.json())
      .then((data) => setUsdtPrice(Math.round(data.rates.NGN)))
      .catch(() => setUsdtPrice(1500));
  }, []);

  // ===== FETCH WALLET BALANCE (PERSISTENT) =====
  const fetchWalletBalance = () => {
    if (!walletAddress) return;

    fetch(`https://tonwallet-rrab.onrender.com/api/balance/${walletAddress}`)
      .then((res) => res.json())
      .then((data) => {
        setWalletBalance(Number(data.usdt_balance) || 0);
      })
      .catch(() => setWalletBalance(0));
  };

  useEffect(() => {
    fetchWalletBalance();
  }, [walletAddress]);

  const usdtAmount =
    currency === "USDT" ? Number(amount) : Number(amount) / usdtPrice;

  const nairaEquivalent = usdtAmount * usdtPrice;

  // ===== TON PAYMENT =====
  const payWithTon = async () => {
    if (!tc || !usdtAmount || !walletAddress) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        "https://tonwallet-rrab.onrender.com/api/create-order",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: walletAddress,
            tonAmount: usdtAmount,
          }),
        }
      );

      const data = await res.json();

      await tc.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: data.payTo,
            amount: String(Math.floor(usdtAmount * 1e9)),
            payload: data.memo,
          },
        ],
      });

      setMessage("Transaction sent. Awaiting confirmation...");
    } catch (err) {
      console.error(err);
      setMessage("Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  // ===== CONNECT TON WALLET =====
  const connectTonWallet = async () => {
    if (!tc) return;

    try {
      setWalletWarning("");
      const wallet: ConnectedWallet = await (tc as any).connectWallet();
      if (wallet) {
        setConnected(true);
        setWalletAddress(wallet.account.address);
      }
    } catch (err) {
      console.error("TON Connect failed:", err);
      setWalletWarning("Failed to connect wallet.");
    }
  };

  // ===== PAYSTACK =====
  const handlePaystackPayment = async () => {
    if (!email || !amount) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        "https://tonwallet-rrab.onrender.com/api/paystack/init",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            nairaAmount: Math.round(nairaEquivalent),
            usdtAmount,
          }),
        }
      );

      const data = await res.json();
      setPaystackReference(data.reference);

      // Open Paystack checkout in new window
      window.open(data.authorization_url, "_blank");
    } catch {
      setMessage("Paystack initialization failed");
    } finally {
      setLoading(false);
    }
  };

  // ===== AUTO CONFIRM PAYSTACK PAYMENT =====
  useEffect(() => {
    if (!paystackReference || !walletAddress) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          "https://tonwallet-rrab.onrender.com/api/confirm",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: paystackReference }),
          }
        );
        const data = await res.json();

        if (data.status === "paid") {
          setMessage("Paystack payment confirmed!");
          setPaystackReference(null);
          fetchWalletBalance();
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paystackReference, walletAddress]);

  // ===== LISTEN FOR PAYSTACK CALLBACK =====
  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const reference = params.get("reference");

      if (reference && walletAddress) {
        setPaystackReference(reference);
        // Optionally remove reference from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleCallback();
  }, [walletAddress]);

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "auto",
        background: "#f9fafb",
        padding: 20,
        borderRadius: 12,
      }}
    >
      <h2>Wallet & Payment</h2>

      {/* ===== PERMANENT WALLET INFO SECTION ===== */}
      <div
        style={{
          background: "#eef2ff",
          padding: 12,
          borderRadius: 8,
          marginBottom: 14,
          fontSize: 13,
          wordBreak: "break-all",
          opacity: connected ? 1 : 0.6,
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>Wallet Address</strong>
          <br />
          {connected ? walletAddress : "Not connected"}
        </p>

        <hr style={{ margin: "8px 0" }} />

        <p style={{ margin: 0 }}>
          <strong>Wallet Balance</strong>
          <br />
          {connected ? `${walletBalance.toFixed(4)} USDT` : "0.0000 USDT"}
        </p>
      </div>

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
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <div style={{ fontSize: 14, marginTop: 8 }}>
        <p>USDT Equivalent: {usdtAmount.toFixed(4)}</p>
        <p>NGN Equivalent: ₦{Math.round(nairaEquivalent)}</p>
      </div>

      {connected ? (
        <button
          disabled={loading}
          onClick={payWithTon}
          style={{ cursor: "pointer" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#3b82f6")}
          onMouseOut={(e) => (e.currentTarget.style.background = "")}
        >
          Pay with TON Wallet
        </button>
      ) : (
        <button
          onClick={connectTonWallet}
          style={{ cursor: "pointer" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#3b82f6")}
          onMouseOut={(e) => (e.currentTarget.style.background = "")}
        >
          Connect TON Wallet
        </button>
      )}

      {walletWarning && (
        <p style={{ color: "red", fontSize: 12 }}>{walletWarning}</p>
      )}

      <hr />

      <label>Email (Paystack)</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button
        disabled={loading}
        onClick={handlePaystackPayment}
        style={{ cursor: "pointer" }}
        onMouseOver={(e) => (e.currentTarget.style.background = "#3b82f6")}
        onMouseOut={(e) => (e.currentTarget.style.background = "")}
      >
        Pay with Paystack
      </button>

      {message && <p>{message}</p>}
    </div>
  );
};

export default Wallet;
