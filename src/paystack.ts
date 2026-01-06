
/**
 * PAYSTACK INLINE PAYMENT
 * ADD-ONLY MODULE
 * Does NOT modify existing logic
 */

declare global {
  interface Window {
    PaystackPop: any;
  }
}

export function payWithPaystack(params: {
  email: string;
  amountNaira: number;
  onSuccess: (reference: string) => void;
  onClose?: () => void;
}) {
  const handler = window.PaystackPop.setup({
    key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
    email: params.email,
    amount: params.amountNaira * 100, // Paystack uses kobo
    currency: "NGN",
    ref: "TON_" + Date.now(),

    callback: function (response: any) {
      params.onSuccess(response.reference);
    },

    onClose: function () {
      params.onClose?.();
    },
  });

  handler.openIframe();
}
