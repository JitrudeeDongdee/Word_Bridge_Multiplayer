import { Link } from 'react-router-dom';

const BASE = import.meta.env.BASE_URL;

/** Privacy policy (static page, readable without JavaScript) and the in-app data deletion page. */
export default function PolicyLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`flex justify-center gap-3 text-xs text-gray-400 ${className}`}>
      <a href={`${BASE}privacy.html`} className="hover:text-gray-600 hover:underline">Privacy Policy</a>
      <span aria-hidden>·</span>
      <Link to="/delete-data" className="hover:text-gray-600 hover:underline">Delete my data</Link>
    </p>
  );
}
