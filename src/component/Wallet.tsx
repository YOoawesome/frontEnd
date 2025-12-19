import React, { useEffect, useState } from "react";
import { TonConnectUI, THEME } from "@tonconnect/ui";
import type { ConnectedWallet } from "@tonconnect/ui";

export const Wallet: React.FC = () => {
  const [tc, setTc] = useState<TonConnectUI | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [tonAmount, setTonAmount] = useState<number>(1);
  const [coinBalance, setCoinBalance] = useState<number>(0);

  const RATE = 5;

  useEffect(() => {
    const ton = new TonConnectUI({
manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
  buttonRootId: "ton-connect",
  uiPreferences: {
    theme: THEME.LIGHT
  }
});

    setTc(ton);

    ton.onStatusChange((status: ConnectedWallet | null) => {
      if (status) setWalletAddress(status.account.address);
      else setWalletAddress("");
    });
  }, []);

  const createOrder = async () => {
    if (!walletAddress) return alert("Connect wallet first");
    if (tonAmount <= 0) return alert("Enter a valid TON amount");

    const order = await fetch("https://tonwallet-rrab.onrender.com/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: walletAddress, tonAmount }),
    }).then((r) => r.json());

    alert("Order created: " + order.orderId);

    if (!tc) return;

    await tc.sendTransaction({
      validUntil: Date.now() + 60000,
      messages: [
        {
          address: order.payTo,
          amount: (tonAmount * 1e9).toString(),
          payload: order.memo,
        },
      ],
    });

    alert("Transaction sent!");
    setCoinBalance((prev) => prev + tonAmount * RATE);
  };

  const confirmOrder = async () => {
    const orderId = prompt("Enter your Order ID:");
    if (!orderId) return;

    const result = await fetch("https://tonwallet-rrab.onrender.com/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    }).then((r) => r.json());

    alert(JSON.stringify(result));
  };

  return (
    <div className="container">
      <h1>TON Coin Converter</h1>

      {/* ✅ CONNECT WALLET BUTTON APPEARS HERE */}
      <div id="ton-connect" style={{ marginBottom: "15px" }} />

      <p>Connected wallet: {walletAddress || "Not connected"}</p>

      <label>Enter TON amount:</label>
      <input
        type="number"
        value={tonAmount}
        onChange={(e) => setTonAmount(Number(e.target.value))}
        min={0}
        step={0.01}
      />

      <button onClick={createOrder} className="buy">
        Buy {tonAmount} TON → {tonAmount * RATE} Coins
      </button>

      <button onClick={confirmOrder} className="confirm">
        Confirm Payment
      </button>

      <p>Your Coin Balance: {coinBalance}</p>
    </div>
  );
};
