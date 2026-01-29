// src/WalletDashboard.tsx
import { useEffect, useState } from "react";
import OriginalWallet from "./component/Wallet";

/* =========================
   TYPES
========================= */
interface Transaction {
  order_id: string;
  method: string;          // e.g. "paystack"
  naira_amount?: number;
  coin_amount: number;
  status: string;          // paid | pending | failed
  created_at: string;
}

/* =========================
   WALLET DASHBOARD
========================= */
const WalletDashboard: React.FC = () => {
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
      const balanceRes = await fetch(
        `https://your-backend-url.com/api/balance/${address}`
      );
      const balanceData = await balanceRes.json();
      setCoins(balanceData.coins || 0);

      // fetch transaction history
      const historyRes = await fetch(
        `https://your-backend-url.com/api/history/${address}`
      );
      const historyData = await historyRes.json();
      setTransactions(historyData || []);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setRefreshing(false);
    }
  };

  // auto-fetch when wallet connects
  useEffect(() => {
    if (walletAddress) fetchData(walletAddress);
  }, [walletAddress]);

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "40px auto",
        fontFamily: "Arial, sans-serif",
        color: "#111",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: 30 }}>
        Wallet Dashboard
      </h1>

      {/* BALANCE */}
      <div
        style={{
          background: "#f0f0f0",
          padding: 20,
          borderRadius: 12,
          marginBottom: 20,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <h2>Coins Balance</h2>
        <p>{coins.toFixed(2)} coins</p>
        <button onClick={() => fetchData(walletAddress)} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* WALLET CONNECT */}
      <div
        style={{
          background: "#f0f0f0",
          padding: 20,
          borderRadius: 12,
          marginBottom: 20,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <WalletConnected onConnect={setWalletAddress} />
      </div>

      {/* TRANSACTION HISTORY */}
      <div
        style={{
          background: "#f0f0f0",
          padding: 20,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <h2>Transaction History</h2>

        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 12,
            }}
          >
            <thead>
              <tr>
                {["ID", "Method", "Amount", "Coins", "Status", "Date"].map(
                  h => (
                    <th
                      key={h}
                      style={{
                        border: "1px solid #ddd",
                        padding: 8,
                        background: "#2563eb",
                        color: "white",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {transactions.map(tx => (
                <tr key={tx.order_id} style={{ background: "#f9f9f9" }}>
                  <td style={{ border: "1px solid #ddd", padding: 8 }}>
                    {tx.order_id.slice(0, 6)}...
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: 8 }}>
                    {tx.method.toUpperCase()}
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: 8 }}>
                    ₦{tx.naira_amount ?? 0}
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: 8 }}>
                    {tx.coin_amount}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ddd",
                      padding: 8,
                      fontWeight: "bold",
                      color:
                        tx.status === "paid"
                          ? "green"
                          : tx.status === "pending"
                          ? "orange"
                          : "red",
                    }}
                  >
                    {tx.status.toUpperCase()}
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: 8 }}>
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
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
   WALLET CONNECTOR WRAPPER
========================= */
interface WalletConnectedProps {
  onConnect: (address: string) => void;
}

const WalletConnected: React.FC<WalletConnectedProps> = ({ onConnect }) => {
  useEffect(() => {
    const handler = (e: any) => {
      onConnect(e.detail);
    };

    window.addEventListener("wallet-connected", handler);
    return () => window.removeEventListener("wallet-connected", handler);
  }, [onConnect]);

  return <OriginalWallet />;
};
