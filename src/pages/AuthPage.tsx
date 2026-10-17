import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, ShieldCheck, Smartphone } from 'lucide-react';
import { FacebookIcon, GoogleIcon } from '../components/BrandIcons';

type Mode = 'login' | 'signup';

/**
 * Log in / Sign up — UI preview only. Accounts aren't built yet: no provider is
 * contacted, no SMS is sent and nothing is stored. Every action ends in a
 * "coming soon" notice; wire the handlers up when auth lands.
 */
export default function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const isSignup = mode === 'signup';
  const [notice, setNotice] = useState<string | null>(null);
  const [phoneStep, setPhoneStep] = useState<'number' | 'code'>('number');
  const [country, setCountry] = useState('+66');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');

  const comingSoon = (what: string) =>
    setNotice(`${what} isn't available yet — this page is a preview. You can keep playing as a guest.`);

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    // Preview: move to the code step without sending anything
    setNotice(null);
    setPhoneStep('code');
  };

  const verifyCode = (e: FormEvent) => {
    e.preventDefault();
    comingSoon('Phone sign-in');
  };

  const providerBtn =
    'w-full inline-flex items-center justify-center gap-3 py-2.5 rounded-xl border font-semibold text-sm transition-colors';

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-4">
        <button
          onClick={() => navigate('/')}
          className="self-start inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden /> Home
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-5">
          <div className="text-center">
            <h1 className="text-2xl font-black text-brand-600">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isSignup
                ? 'Keep your name, scores and rooms across devices.'
                : 'Log in to pick up where you left off.'}
            </p>
          </div>

          <p className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            <Info className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden />
            <span>
              <b>Preview.</b> Accounts aren't live yet — nothing is sent or saved.
            </span>
          </p>

          {isSignup && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What other players see"
                maxLength={20}
                className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => comingSoon('Google sign-in')}
              className={`${providerBtn} bg-white border-gray-300 text-gray-700 hover:bg-gray-50`}
            >
              <GoogleIcon /> Continue with Google
            </button>
            <button
              type="button"
              onClick={() => comingSoon('Facebook sign-in')}
              className={`${providerBtn} bg-[#1877F2] border-[#1877F2] text-white hover:bg-[#166FE5]`}
            >
              <FacebookIcon /> Continue with Facebook
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex-1 h-px bg-gray-200" />
            or use your phone
            <span className="flex-1 h-px bg-gray-200" />
          </div>

          {phoneStep === 'number' ? (
            <form onSubmit={sendCode} className="flex flex-col gap-2">
              <label htmlFor="auth-phone" className="text-sm text-gray-600 inline-flex items-center gap-1">
                <Smartphone className="w-4 h-4" aria-hidden /> Phone number
              </label>
              <div className="flex gap-2">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  aria-label="Country code"
                  className="px-2 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="+66">TH +66</option>
                  <option value="+1">US +1</option>
                  <option value="+44">UK +44</option>
                  <option value="+65">SG +65</option>
                  <option value="+81">JP +81</option>
                </select>
                <input
                  id="auth-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
                  placeholder="81 234 5678"
                  maxLength={15}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={phone.replace(/\D/g, '').length < 8}
                className="py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                Send code
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="flex flex-col gap-2">
              <label htmlFor="auth-code" className="text-sm text-gray-600 inline-flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" aria-hidden /> Enter the 6-digit code sent to {country} {phone}
              </label>
              <input
                id="auth-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="px-3 py-2 rounded-lg border border-gray-300 text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={code.length < 6}
                className="py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {isSignup ? 'Verify & create account' : 'Verify & log in'}
              </button>
              <button
                type="button"
                onClick={() => { setPhoneStep('number'); setCode(''); setNotice(null); }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Use a different number
              </button>
              <p className="text-[11px] text-gray-400 text-center">Preview: no SMS was actually sent.</p>
            </form>
          )}

          {notice && (
            <p role="status" className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
              {notice}
            </p>
          )}

          <p className="text-sm text-gray-500 text-center">
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            <Link to={isSignup ? '/login' : '/signup'} className="font-semibold text-brand-600 hover:underline">
              {isSignup ? 'Log in' : 'Sign up'}
            </Link>
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Continue as guest
        </button>
      </div>
    </div>
  );
}
