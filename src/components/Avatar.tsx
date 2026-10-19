import { initials } from '../utils/avatar';

/** Round avatar: the member's photo, or their initials on the brand colour. */
export default function Avatar({ name, photo, size = 32 }: { name: string; photo?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  return photo ? (
    <img src={photo} alt="" style={style} className="rounded-full object-cover flex-shrink-0 bg-gray-100" />
  ) : (
    <span style={style} aria-hidden className="rounded-full flex-shrink-0 inline-flex items-center justify-center bg-brand-500 text-white font-bold">
      {initials(name)}
    </span>
  );
}
