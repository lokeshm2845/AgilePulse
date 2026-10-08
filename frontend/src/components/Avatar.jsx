const PALETTE = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-fuchsia-500 to-purple-500',
];

function hash(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

/** Coloured initials avatar - the same person always gets the same colour */
export default function Avatar({ name, size = 'sm', online = false, className = '', title }) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} title={title || name}>
      <span
        className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-white ${SIZES[size]} ${
          PALETTE[hash(name) % PALETTE.length]
        }`}
      >
        {initials(name)}
      </span>
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />}
    </span>
  );
}
