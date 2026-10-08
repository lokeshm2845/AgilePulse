import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../services/api';
import Alert from './Alert';
import AuthShell from './AuthShell';
import { ArrowRightIcon } from './Icons';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/board" replace />;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) {
      setError('Please enter your email and password');
      return;
    }
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from?.pathname || '/board', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your team's board.">
      <Alert message={location.state?.registered ? 'Account created — you can sign in now.' : ''} type="success" />
      <Alert message={error} onClose={() => setError('')} />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@team.com" className="input" value={form.email} onChange={handleChange} autoFocus />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" className="input" value={form.password} onChange={handleChange} />
        </div>
        <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting && <ArrowRightIcon className="h-4 w-4" />}
        </button>
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
