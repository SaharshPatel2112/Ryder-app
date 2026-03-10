import { useState } from "react";
import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";

export default function StripeCheckout({
  fare,
  onSuccess,
  onCancel,
}: {
  fare: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "An unexpected error occurred.");
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <h2 className="text-2xl font-black text-gray-900 mb-2">Card Details</h2>
      <p className="text-gray-500 mb-8 font-medium">
        Secure payment powered by Stripe.
      </p>

      <div className="bg-white p-5 rounded-2xl border border-gray-200 mb-6 shadow-sm">
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="text-red-500 text-sm font-bold mb-4 text-center bg-red-50 p-3 rounded-xl">
          {errorMessage}
        </div>
      )}

      <button
        disabled={isProcessing || !stripe || !elements}
        className="w-full bg-black text-white font-bold text-xl py-4 rounded-2xl shadow-lg hover:bg-gray-800 transition-all active:scale-95 disabled:bg-gray-400"
      >
        {isProcessing ? "Processing via Stripe..." : `Pay ₹${fare}`}
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={isProcessing}
        className="mt-6 text-gray-500 font-bold hover:text-black text-center w-full"
      >
        Cancel
      </button>
    </form>
  );
}
