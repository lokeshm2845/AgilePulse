import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../services/api';
import Alert from './Alert';
import AuthShell from './AuthShell';
import { ArrowRightIcon, BoardIcon, ListIcon, RocketIcon } from './Icons';

const ROLES = [
  { value: 'PO', label: 'Product Owner', hint: 'Manages the backlog', icon: ListIcon, demo: 'po@agilepulse.dev' },
  { value: 'SM', label: 'Scrum Master', hint: 'Plans the sprints', icon: RocketIcon, demo: 'sm@agilepulse.dev' },
  { value: 'DEV', label: 'Developer', hint: 'Moves the cards', icon: BoardIcon, demo: 'dev@agilepulse.dev' },
];
const DEMO_PASSWORD = 'password123';
// Demo shortcuts are shown unless the deployment sets VITE_HIDE_DEMO=true
const SHOW_DEMO = import.meta.env.VITE_HIDE_DEMO !== 'true';

function lastRole() {
  try {
    return localStorage.getItem('agilepulse.role') || 'DEV';
  } catch {
    return 'DEV';
  }
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(lastRole);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/board" replace />;

  const selected = ROLES.find((r) => r.value === role);
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const chooseRole = (value) => {
    setRole(value);
    setError('');
  };

  const fillDemo = () => {
    setForm({ email: selected.demo, password: DEMO_PASSWORD });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) {
      setError('Please enter your email and password');
      return;
    }
    setSubmitting(true);
    try {
      await login(form.email, form.password, role);
      try {
        localStorage.setItem('agilepulse.role', role);
      } catch {
        /* storage unavailable - not important */
      }
      navigate(location.state?.from?.pathname || '/board', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      // Wrong role chosen: switch the picker to the account's real role
      const actual = err.response?.status === 403 && err.response.data?.role;
      if (actual) setRole(actual);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Choose who is signing in, then enter your details.">
      <Alert message={location.state?.registered ? 'Account created — you can sign in now.' : ''} type="success" />
      <Alert message={error} onClose={() => setError('')} />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* ---- Who's signing in? ---- */}
        <fieldset>
          <legend className="label">I am signing in as</legend>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(({ value, label, hint, icon: Icon }) => {
              const active = role === value;
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-3 text-center transition focus-within:ring-4 focus-within:ring-indigo-500/20 ${
                    active ? 'border-indigo-500 bg-indigo-50/70 shadow-glow' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input type="radio" name="role" value={value} checked={active} onChange={() => chooseRole(value)} className="sr-only" />
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className={`text-xs font-semibold leading-tight ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{label}</span>
                  <span className="hidden text-[10px] leading-tight text-slate-400 sm:block">{hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@team.com" className="input" value={form.email} onChange={handleChange} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" className="input" value={form.password} onChange={handleChange} />
        </div>

        <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
          {submitting ? 'Signing in…' : `Sign in as ${selected.label}`}
          {!submitting && <ArrowRightIcon className="h-4 w-4" />}
        </button>

        {SHOW_DEMO && (
          <button
            type="button"
            onClick={fillDemo}
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-left text-xs transition hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <span className="text-slate-500">
              Demo account: <span className="font-semibold text-slate-700">{selected.demo}</span>
            </span>
            <span className="font-semibold text-indigo-600">Fill in</span>
          </button>
        )}
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        New to AgilePulse?{' '}
        <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
