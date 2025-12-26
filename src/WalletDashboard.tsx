// src/WalletDashboard.tsx
import { useEffect, useState } from "react";
import Wallet from "./component/Wallet"; // your Wallet.tsx
interface Transaction {
  order_id: string;
  method: string;
  ton_amount?: number;
  naira_amount?: number;
  coin_amount: number;
  status: string;
  created_at: string;
}

export const WalletDashboard: React.FC = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [coins, setCoins] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  /* =========================
     FETCH BALANCE & HISTORY
  ========================= */
  const fetchData = async (address: string) => {
    if (!address) return;
    setRefreshing(true);

    try {
      // fetch balance
      const balanceRes = await fetch(`https://tonwallet-rrab.onrender.com/api/balance/${address}`);
      const balanceData = await balanceRes.json();
      setCoins(balanceData.coins || 0);

      // fetch history
      const historyRes = await fetch(`https://tonwallet-rrab.onrender.com/api/history/${address}`);
      const historyData = await historyRes.json();
      setTransactions(historyData || []);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setRefreshing(false);
    }
  };

  // auto-fetch when walletAddress changes
  useEffect(() => {
    if (walletAddress) fetchData(walletAddress);
  }, [walletAddress]);

  /* =========================
     HANDLER FOR WALLET.TSX
     This will be passed as a prop
  ========================= */
  const handleWalletConnect = (address: string) => {
    setWalletAddress(address);
  };

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", fontFamily: "Arial, sans-serif", color: "#111" }}>
      <h1 style={{ textAlign: "center", marginBottom: 30 }}>Wallet Dashboard</h1>

      {/* Coins Summary */}
      <div style={{ background: "#f0f0f0", padding: 20, borderRadius: 12, marginBottom: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <h2>Coins Balance</h2>
        <p>{coins.toFixed(2)} coins</p>
        <button onClick={() => fetchData(walletAddress)} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Wallet Component with callback */}
      <div style={{ background: "#f0f0f0", padding: 20, borderRadius: 12, marginBottom: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <WalletConnected onConnect={handleWalletConnect} />
      </div>

      {/* Transaction History */}
      <div style={{ background: "#f0f0f0", padding: 20, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <h2>Transaction History</h2>
        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ddd", padding: 8, background: "#2563eb", color: "white" }}>ID</th>
                <th style={{ border: "1px solid #ddd", padding: 8, background: "#2563eb", color: "white" }}>Method</th>
                <th style={{ border: "1px solid #ddd", padding: 8, background: "#2563eb", color: "white" }}>Amount</th>
                <th style={{ border: "1px solid #ddd", padding: 8, background: "#2563eb", color: "white" }}>Coins</th>
                <th style={{ border: "1px solid #ddd", padding: 8, background: "#2563eb", color: "white" }}>Status</th>
                <th style={{ border: "1px solid #ddd", padding: 8, background: "#2563eb", color: "white" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.order_id} style={{ background: "#f9f9f9" }}>
                  <td style={{ border: "1px solid #ddd", padding: 8 }}>{tx.order_id.slice(0, 6)}...</td>
                  <td style={{ border: "1px solid #ddd", padding: 8 }}>{tx.method.toUpperCase()}</td>
                  <td style={{ border: "1px solid #ddd", padding: 8 }}>
                    {tx.method === "paystack" ? `₦${tx.naira_amount}` : `${tx.ton_amount} TON`}
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: 8 }}>{tx.coin_amount}</td>
                  <td style={{ border: "1px solid #ddd", padding: 8, fontWeight: "bold", color: tx.status === "paid" ? "green" : tx.status === "pending" ? "orange" : "red" }}>
                    {tx.status.toUpperCase()}
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: 8 }}>{new Date(tx.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default WalletDashboard;

/* =========================
   Wrapper for Wallet.tsx
   to inject onConnect callback without changing original Wallet
========================= */
import React from "react";
import OriginalWallet from "./component/Wallet";

interface WalletConnectedProps {
  onConnect: (address: string) => void;
}

const WalletConnected: React.FC<WalletConnectedProps> = ({ onConnect }) => {
  // Patch Wallet.tsx's internal state by listening to DOM events
  // We'll override the Wallet component's connect callback
  // Safe because we are not modifying the original Wallet.tsx code

  return <OriginalWalletWrapper onConnect={onConnect} />;
};

/* =========================
   OriginalWalletWrapper
   Uses the Wallet.tsx component as-is
   and exposes the walletAddress to the dashboard
========================= */
const OriginalWalletWrapper: React.FC<{ onConnect: (address: string) => void }> = ({ onConnect }) => {
  // hack: use MutationObserver or interval to detect wallet address change
  // but simpler: you can add a tiny useEffect in Wallet.tsx to dispatch a custom event
  // For now, we'll assume the Wallet.tsx can dispatch `window.dispatchEvent(new CustomEvent('wallet-connected', { detail: address }))`
  useEffect(() => {
    const handler = (e: any) => {
      onConnect(e.detail);
    };
    window.addEventListener("wallet-connected", handler);
    return () => window.removeEventListener("wallet-connected", handler);
  }, [onConnect]);

  return <OriginalWallet />;
};
