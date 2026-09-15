import { paymentApi } from './endpoints';
import type { PaymentIntent } from '@/types';

/* ============================================================
   Ek hi checkout runner - MOCK aur RAZORPAY dono ke liye.

   Pages ko bas `runCheckout(intent, prefill)` call karna hai;
   provider ke hisaab se sahi flow apne aap chalta hai:

     MOCK     -> server hi valid signature de deta hai
     RAZORPAY -> asli checkout popup khulta hai

   Dono case me wapas same shape milti hai, isliye /payments/verify
   ka code har jagah ek jaisa rehta hai.
   ============================================================ */

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

export interface CheckoutResult {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signature: string;
  method?: string;
}

export interface CheckoutPrefill {
  name?: string;
  email?: string;
  contact?: string;
  /** Checkout popup me kya dikhana hai (jaise "Order ORD-20260915-1001") */
  description?: string;
}

/** User ne khud popup band kar diya - ye error nahi hai, cancel hai. */
export class CheckoutCancelledError extends Error {
  constructor() {
    super('Payment was cancelled.');
    this.name = 'CheckoutCancelledError';
  }
}

/** Gateway ne payment fail bataya (card decline, insufficient funds waghera). */
export class CheckoutFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutFailedError';
  }
}

/* ---------------------- Razorpay script loader --------------------- */

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay only works in the browser.'));
  }

  if (window.Razorpay) return Promise.resolve();

  // ek hi baar load karo, chahe kitni baar call ho
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT}"]`);

    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Razorpay script failed to load.')));
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;

    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;   // agli baar dobara try kar sakein
      reject(new Error('Razorpay script failed to load. Check your internet connection.'));
    };

    document.body.appendChild(script);
  });

  return scriptPromise;
}

/* --------------------------- main runner --------------------------- */

export async function runCheckout(
  intent: PaymentIntent,
  prefill: CheckoutPrefill = {},
): Promise<CheckoutResult> {
  if (intent.provider === 'MOCK') {
    const result = await paymentApi.mockCheckout(intent.gatewayOrderId);

    return {
      gatewayOrderId: result.gatewayOrderId,
      gatewayPaymentId: result.gatewayPaymentId,
      signature: result.signature,
      method: result.method,
    };
  }

  if (intent.provider === 'RAZORPAY') {
    return openRazorpayCheckout(intent, prefill);
  }

  throw new Error(`Payment provider "${intent.provider}" is not supported.`);
}

/* -------------------------- Razorpay popup ------------------------- */

function openRazorpayCheckout(
  intent: PaymentIntent,
  prefill: CheckoutPrefill,
): Promise<CheckoutResult> {
  return loadRazorpayScript().then(
    () =>
      new Promise<CheckoutResult>((resolve, reject) => {
        if (!window.Razorpay) {
          reject(new Error('Razorpay did not load.'));
          return;
        }

        // handler ya dismiss - dono me se ek hi baar settle hona chahiye
        let settled = false;

        const rzp = new window.Razorpay({
          key: intent.keyId,
          // Razorpay amount PAISE me leta hai
          amount: Math.round(intent.amount * 100),
          currency: intent.currency,
          order_id: intent.gatewayOrderId,
          name: 'FoodMitra',
          description: prefill.description ?? intent.receipt,
          image: `${window.location.origin}/favicon.svg`,

          prefill: {
            name: prefill.name ?? '',
            email: prefill.email ?? '',
            contact: prefill.contact ?? '',
          },

          notes: { receipt: intent.receipt },
          theme: { color: '#e23744' },

          handler: (response) => {
            if (settled) return;
            settled = true;

            // Razorpay success handler payment method nahi bhejta -
            // backend chahe to Payments API se fetch kar sakta hai.
            resolve({
              gatewayOrderId: response.razorpay_order_id,
              gatewayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
          },

          modal: {
            ondismiss: () => {
              if (settled) return;
              settled = true;
              reject(new CheckoutCancelledError());
            },
          },
        });

        rzp.on('payment.failed', (response) => {
          if (settled) return;
          settled = true;

          const err = response.error;
          const reason = err?.description || err?.reason || 'The payment failed.';

          reject(new CheckoutFailedError(reason));
        });

        rzp.open();
      }),
  );
}

/* ---------------------- window.Razorpay typing --------------------- */

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailureResponse {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
    source?: string;
    step?: string;
  };
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}
