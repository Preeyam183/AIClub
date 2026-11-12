import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, House, Mail, CheckCircle2 } from 'lucide-react';
import { useApp, errorText } from '../context/AppContext';
import { isDemo, supabase } from '../lib/supabase';
import { Modal } from './Modal';

export function AuthModal() {
  const { setAuthOpen, demoSignIn } = useApp();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setSent(true);
    } catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  }
  return <Modal title="Sign in to RentCheck" onClose={() => setAuthOpen(false)}>
    <span className="modal-symbol">{sent ? <CheckCircle2 /> : <House />}</span>
    <p className="eyebrow">MAKE YOURSELF AT HOME</p>
    <h2>{sent ? 'Check your inbox.' : 'Your next place starts here.'}</h2>
    {isDemo ? <><p className="muted">You’re exploring the demo. Use a local demo account to save places, post a listing, and try things out.</p><button className="button primary wide" onClick={demoSignIn}>Continue with demo account <ArrowRight size={17} /></button><p className="fine-print">Demo changes stay in this browser. No email is sent.</p></> : sent ? <><p className="muted">We sent a sign-in link to <strong>{email}</strong>. Open it to securely sign in or create your account.</p><button className="button secondary wide" onClick={() => setSent(false)}>Use a different email</button></> : <><p className="muted">Save your favorites, reach out to owners, or list your place. All with a simple email link.</p><form onSubmit={submit}><label className="field">Email address<div className="input-icon"><Mail size={18} /><input type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} /></div></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary wide" disabled={busy}>{busy ? 'Sending link…' : 'Continue with email'}<ArrowRight size={17} /></button></form><p className="fine-print">No password to remember. Just you and your inbox.</p></>}
  </Modal>;
}
