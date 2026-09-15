import { useEffect, useState } from 'react';
import { useLocationCtx } from '@/context/LocationContext';

/**
 * Bottom-right floating WhatsApp button.
 * Number aur default message backend ke AppSettings se aate hain
 * (admin panel > Settings me badal sakte ho).
 */
export default function WhatsAppButton() {
  const { whatsAppLink, settings } = useLocationCtx();
  const [expanded, setExpanded] = useState(false);
  const [showTip, setShowTip] = useState(false);

  /* thodi der baad ek chhota nudge - phir chup ho jaata hai */
  useEffect(() => {
    const show = setTimeout(() => setShowTip(true), 4000);
    const hide = setTimeout(() => setShowTip(false), 11000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  const phone = settings.SupportPhone ?? '+919810000000';

  const quickMessages = [
    { label: 'Check my order status', text: 'Hi FoodMitra! What is the status of my order?' },
    { label: 'I want to book a table', text: 'Hi FoodMitra! I need help with a table booking.' },
    { label: 'Birthday party ka hall', text: 'Hi FoodMitra! I want to book a hall for a birthday party.' },
    { label: 'Payment / refund issue', text: 'Hi FoodMitra! I have a payment or refund issue.' },
  ];

  return (
    <div className="fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
      {/* quick message menu */}
      {expanded && (
        <div className="w-64 animate-fade-up overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-pop">
          <div className="flex items-center gap-2 bg-[#25D366] px-4 py-3">
            <WhatsAppGlyph className="size-5 text-white" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">FoodMitra Support</p>
              <p className="truncate text-[11px] text-white/85">Aam taur par 5 min me reply</p>
            </div>
          </div>

          <div className="p-2">
            {quickMessages.map((m) => (
              <a
                key={m.label}
                href={whatsAppLink(m.text)}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => setExpanded(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
              >
                {m.label}
              </a>
            ))}
          </div>

          <div className="border-t border-ink-100 px-4 py-2.5">
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-2 text-xs font-semibold text-ink-500 transition hover:text-brand-700"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" strokeLinecap="round" />
              </svg>
              Ya phone karo: {phone}
            </a>
          </div>
        </div>
      )}

      {/* nudge bubble */}
      {showTip && !expanded && (
        <button
          type="button"
          onClick={() => { setExpanded(true); setShowTip(false); }}
          className="animate-fade-up cursor-pointer rounded-full rounded-br-sm border border-ink-100 bg-white px-3.5 py-2 text-xs font-semibold text-ink-700 shadow-card"
        >
          Need help? Message us on WhatsApp
        </button>
      )}

      {/* main FAB */}
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); setShowTip(false); }}
        aria-expanded={expanded}
        aria-label="WhatsApp par help lo"
        className="group relative grid size-14 cursor-pointer place-items-center rounded-full bg-[#25D366] text-white shadow-pop transition hover:scale-105 hover:bg-[#1eb855] active:scale-95"
      >
        {!expanded && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30" aria-hidden="true" />
        )}

        {expanded ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="relative size-6">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        ) : (
          <WhatsAppGlyph className="relative size-7" />
        )}
      </button>
    </div>
  );
}

function WhatsAppGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.1s-.8 1-1 1.2c-.2.2-.4.3-.7.1a8.3 8.3 0 0 1-2.4-1.5 9.2 9.2 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.6-.7c.2-.2.2-.4.3-.6s0-.4-.1-.6l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.1.2 2.1 3.3 5.1 4.5 1.8.7 2.5.8 3.4.6.5-.1 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1 0-.1-.2-.2-.5-.3z" />
      <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
    </svg>
  );
}
