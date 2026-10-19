import { BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { needsConsent, onConsentChange, setConsent } from '../services/analytics';

const BASE = import.meta.env.BASE_URL;

/**
 * PDPA consent for Google Analytics. Shown once, on the production site only; nothing is
 * measured until "Accept". The choice can be changed later from "Cookie settings".
 */
export default function ConsentBanner() {
  const [open, setOpen] = useState(needsConsent);
  useEffect(() => onConsentChange(() => setOpen(needsConsent())), []);
  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 pointer-events-none">
      <div
        role="dialog"
        aria-label="Analytics cookies"
        className="pointer-events-auto w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex gap-3">
          <BarChart3 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600" aria-hidden />
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-gray-900">ขอเก็บสถิติการใช้งาน</p>
            <p className="mt-1">
              เราใช้ Google Analytics นับจำนวนการเข้าชมและการเล่น (เช่น สร้างห้อง เริ่มเกม) เพื่อนำไปปรับปรุงเกม
              ไม่เก็บคำที่เล่น ข้อความแชท หรือชื่อของคุณ และจะเริ่มเก็บก็ต่อเมื่อคุณกดยอมรับ
            </p>
            <p className="mt-1 text-xs text-gray-500">
              We use Google Analytics cookies to count visits and gameplay, only if you accept.{' '}
              <a href={`${BASE}privacy.html#analytics`} className="underline hover:text-gray-700">Privacy Policy</a>
            </p>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={() => setConsent('denied')}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            ไม่ยอมรับ
          </button>
          <button
            onClick={() => setConsent('granted')}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            ยอมรับ
          </button>
        </div>
      </div>
    </div>
  );
}
