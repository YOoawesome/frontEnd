declare module "react-paystack" {
  import React from "react";

  export interface PaystackButtonProps {
    email: string;
    amount: number;
    publicKey: string;
    currency?: string;
    onSuccess?: (response: any) => void;
    onClose?: () => void;
    text?: string;
    className?: string;
  }

  export const PaystackButton: React.FC<PaystackButtonProps>;
}
