import React, { useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import type { ConnectedWallet } from "@tonconnect/ui";

/**
 * SIDE NOTE:
 * - Backend logic is USDT-only
 * - UI can show NGN or USDT
 * - 1 USDT = 5 coins (DO NOT CHANGE)
 */

const COIN_RATE = 5; // 1 USDT = 5 coins

export const Wallet: React.FC = () => {
  const [tc, setTc] = useState<TonConnectUI | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [connected, setConnected] = useState(false);

  // ===== Currency & Amount =====
  const [currency, setCurrency] = useState<"USDT" | "NGN">("USDT");
  const [amount, setAmount] = useState("");
  const [usdtPrice, setUsdtPrice] = useState(1500); // default fallback
  const [email, setEmail] = useState("");

  // ===== UI Feedback =====
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  /* =========================
     INIT TON CONNECT
  ========================= */
  useEffect(() => {
    const ui = new TonConnectUI({
      manifestUrl: "/tonconnect-manifest.json",
    });

    setTc(ui);

    ui.onStatusChange((wallet: ConnectedWallet | null) => {
      if (wallet) {
        setConnected(true);
        setWalletAddress(wallet.account.address);
      } else {
        setConnected(false);
        setWalletAddress("");
      }
    });
  }, []);

  /* =========================
     FETCH USDT PRICE (NGN)
     SIDE NOTE:
     - You may later replace this with CoinGecko / Binance
  ========================= */
  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then(res => res.json())
      .then(data => {
        // Assuming 1 USDT ≈ 1 USD
        setUsdtPrice(Math.round(data.rates.NGN));
      })
      .catch(() => {
        setUsdtPrice(1500); // safe fallback
      });
  }, []);

  /* =========================
     NORMALIZATION (USDT-ONLY)
  ========================= */
  const usdtAmount =
    currency === "USDT"
      ? Number(amount)
      : Number(amount) / usdtPrice;

  const nairaEquivalent = usdtAmount * usdtPrice;
  const coinEquivalent = usdtAmount * COIN_RATE;

  /* =========================
     TON PAYMENT
  ========================= */
  const payWithTon = async () => {
    if (!tc || !usdtAmount || !walletAddress) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("https://tonwallet-rrab.onrender.com/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          tonAmount: usdtAmount,
        }),
      });

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
      setMessage("Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     PAYSTACK PAYMENT (NO WALLET REQUIRED)
  ========================= */
  const payWithPaystack = async () => {
    if (!email || !amount) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("https://tonwallet-rrab.onrender.com/api/paystack/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          nairaAmount: Math.round(nairaEquivalent),
          usdtAmount,
          usdtRate: usdtPrice, // LOCK RATE
        }),
      });

      const data = await res.json();

      window.location.href = `https://checkout.paystack.com/${data.reference}`;
    } catch {
      setMessage("Paystack initialization failed");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <div style={{
    maxWidth: 420,
    margin: "auto",
    background: "#f9fafb",
    padding: 20,
    borderRadius: 12,
  }}>
      <h2>Wallet & Payment</h2>

      {/* Currency Selector */}
      <label>Currency</label>
      <select
        value={currency}
        onChange={e => setCurrency(e.target.value as any)}
      >
        <option value="USDT">USDT</option>
        <option value="NGN">NGN</option>
      </select>

      {/* Amount */}
      <label>Amount ({currency})</label>
      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />

      {/* Breakdown */}
      <div style={{ fontSize: 14, marginTop: 8 }}>
        <p>USDT: {usdtAmount.toFixed(4)}</p>
        <p>NGN: ₦{Math.round(nairaEquivalent)}</p>
        <p>Coins: {coinEquivalent.toFixed(2)}</p>
      </div>

      {/* TON WALLET */}
      {connected ? (
        <button disabled={loading} onClick={payWithTon}>
          Pay with TON Wallet
        </button>
      ) : (
        <button onClick={() => tc?.connectWallet()}>
          Connect TON Wallet
        </button>
      )}

      <hr />

      {/* PAYSTACK */}
      <label>Email (Paystack)</label>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <button disabled={loading} onClick={payWithPaystack}>
        Pay with Paystack
      </button>

      {/* STATUS */}
      {message && <p>{message}</p>}
    </div>
  );
};

export default Wallet;
