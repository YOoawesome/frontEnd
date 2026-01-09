import React, { useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import type { ConnectedWallet } from "@tonconnect/ui";

/**
 * SIDE NOTE:
 * - Backend logic is USDT-only
 * - UI can show NGN or USDT
 * - Wallet balance is recorded server-side and persists after refresh
 * - Paystack inline modal avoids fullscreen warnings
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

  // ===== Paystack modal state =====
  const [showPaystackModal, setShowPaystackModal] = useState(false);
  const [paystackUrl, setPaystackUrl] = useState("");

  // ===== Validation errors =====
  const [errors, setErrors] = useState({ email: "", amount: "" });
  const [isPaystackReady, setIsPaystackReady] = useState(false);

  const validatePayment = () => {
    let newErrors = { email: "", amount: "" };
    const emailRegex = /\S+@\S+\.\S+/;

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Invalid email address";
    }

    if (!amount) {
      newErrors.amount = "Amount is required";
    } else if (Number(amount) <= 0) {
      newErrors.amount = "Amount must be a positive number";
    }

    setErrors(newErrors);
    return !newErrors.email && !newErrors.amount;
  };

  useEffect(() => {
    const emailValid = /\S+@\S+\.\S+/.test(email);
    const amountValid = Number(amount) > 0;
    setIsPaystackReady(emailValid && amountValid);
    setErrors({
      email: email ? (emailValid ? "" : "Invalid email address") : "Email is required",
      amount: amount ? (amountValid ? "" : "Amount must be positive") : "Amount is required",
    });
  }, [email, amount]);

  useEffect(() => {
    const ui = new TonConnectUI({ manifestUrl: `${window.location.origin}/tonconnect-manifest.json` });
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

  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then(res => res.json())
      .then(data => setUsdtPrice(Math.round(data.rates.NGN)))
      .catch(() => setUsdtPrice(1500));
  }, []);

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`https://tonwallet-rrab.onrender.com/api/balance/${walletAddress}`)
      .then(res => res.json())
      .then(data => setWalletBalance(Number(data.usdt_balance) || 0))
      .catch(() => setWalletBalance(0));
  }, [walletAddress]);

  const usdtAmount = currency === "USDT" ? Number(amount) : Number(amount) / usdtPrice;
  const nairaEquivalent = usdtAmount * usdtPrice;

  const payWithTon = async () => {
    if (!tc || !usdtAmount || !walletAddress) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("https://tonwallet-rrab.onrender.com/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, tonAmount: usdtAmount }),
      });
      const data = await res.json();
      await tc.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: data.payTo, amount: String(Math.floor(usdtAmount * 1e9)), payload: data.memo }],
      });
      setMessage("Transaction sent. Awaiting confirmation...");
    } catch {
      setMessage("Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  const connectTonWallet = async () => {
    if (!tc) return;
    try {
      setWalletWarning("");
      const wallet: ConnectedWallet = await (tc as any).connectWallet();
      if (wallet) {
        setConnected(true);
        setWalletAddress(wallet.account.address);
      }
    } catch {
      setWalletWarning("Failed to connect wallet.");
    }
  };

  const handlePaystackPayment = async () => {
    if (!validatePayment()) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("https://tonwallet-rrab.onrender.com/api/paystack/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nairaAmount: Math.round(nairaEquivalent), usdtAmount }),
      });
      const data: any = await res.json();
      setPaystackUrl(data.authorization_url);
      setShowPaystackModal(true);
    } catch {
      setMessage("Paystack initialization failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "auto", background: "#f9fafb", padding: 20, borderRadius: 12 }}>
      <h2>Wallet & Payment</h2>

      <div style={{ background: "#eef2ff", padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13, wordBreak: "break-all", opacity: connected ? 1 : 0.6 }}>
        <p style={{ margin: 0 }}>
          <strong>Wallet Address</strong><br />
          {connected ? walletAddress : "Not connected"}
        </p>
        <hr style={{ margin: "8px 0" }} />
        <p style={{ margin: 0 }}>
          <strong>Wallet Balance</strong><br />
          {connected ? `${walletBalance.toFixed(4)} USDT` : "0.0000 USDT"}
        </p>
      </div>

      <label>Currency</label>
      <select value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
        <option value="USDT">USDT</option>
        <option value="NGN">NGN</option>
      </select>

      <label>Amount ({currency})</label>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" />
      {errors.amount && <p style={{ color: "red", fontSize: 12 }}>{errors.amount}</p>}

      <div style={{ fontSize: 14, marginTop: 8 }}>
        <p>USDT Equivalent: {usdtAmount.toFixed(4)}</p>
        <p>NGN Equivalent: ₦{Math.round(nairaEquivalent)}</p>
      </div>

      {connected ? (
        <button disabled={loading} onClick={payWithTon} style={{ cursor: "pointer" }}>
          Pay with TON Wallet
        </button>
      ) : (
        <button onClick={connectTonWallet} style={{ cursor: "pointer" }}>
          Connect TON Wallet
        </button>
      )}

      {walletWarning && <p style={{ color: "red", fontSize: 12 }}>{walletWarning}</p>}

      <hr />
      <div style={{ margin: "auto", background: "#87bcf1ff", padding: 30, borderRadius: 12 }}>
        <label>Pay with Paystack</label>
        <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {errors.email && <p style={{ color: "red", fontSize: 12 }}>{errors.email}</p>}

        {isPaystackReady && (
          <button
            disabled={loading}
            onClick={handlePaystackPayment}
            style={{
              backgroundColor: "#ADD8E6",
              color: "black",
              cursor: "pointer",
              padding: "8px 16px",
              border: "none",
              borderRadius: 6,
              marginTop: 10,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#00008B";
              (e.currentTarget as HTMLButtonElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#ADD8E6";
              (e.currentTarget as HTMLButtonElement).style.color = "black";
            }}
          >
            Pay
          </button>
        )}

        {/* ===== PAYSTACK MODAL INLINE IFRAME ===== */}
        {showPaystackModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
          }}>
            <div style={{ width: "100%", maxWidth: 500, height: 600, background: "#fff", borderRadius: 12, overflow: "hidden", position: "relative" }}>
              <button
                onClick={() => setShowPaystackModal(false)}
                style={{ position: "absolute", top: 10, right: 10, zIndex: 10, cursor: "pointer" }}
              >
                Close
              </button>
              <iframe
                src={paystackUrl}
                style={{ width: "100%", height: "100%", border: "none" }}
                title="Paystack Payment"
              />
            </div>
          </div>
        )}
      </div>

      {message && <p>{message}</p>}
    </div>
  );
};

export default Wallet;
