import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../services/api';
import Alert from './Alert';
import AuthShell from './AuthShell';
import { BoardIcon, ListIcon, RocketIcon } from './Icons';

const ROLES = [
  { value: 'PO', label: 'Product Owner', hint: 'Owns the backlog', icon: ListIcon },
  { value: 'SM', label: 'Scrum Master', hint: 'Plans sprints', icon: RocketIcon },
  { value: 'DEV', label: 'Developer', hint: 'Moves the cards', icon: BoardIcon },
];

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'DEV' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/board" replace />;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) {
      setError('All fields are required');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      await register(form);
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Join your Scrum team on AgilePulse.">
      <Alert message={error} onClose={() => setError('')} />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input id="name" name="name" placeholder="Lokesh Magare" className="input" value={form.name} onChange={handleChange} autoFocus />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@team.com" className="input" value={form.email} onChange={handleChange} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" className="input" value={form.password} onChange={handleChange} />
        </div>

        <fieldset>
          <legend className="label">Your role</legend>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(({ value, label, hint, icon: Icon }) => {
              const active = form.role === value;
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-3 text-center transition focus-within:ring-4 focus-within:ring-indigo-500/20 ${
                    active ? 'border-indigo-500 bg-indigo-50/70 shadow-glow' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input type="radio" name="role" value={value} checked={active} onChange={handleChange} className="sr-only" />
                  <Icon className={`h-5 w-5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className={`text-xs font-semibold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{label}</span>
                  <span className="text-[10px] text-slate-400">{hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
