import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowUpRight, Check, Heart, House, LogOut, Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isDemo } from '../lib/supabase';
import { AuthModal } from './AuthModal';

export function Layout() {
  const { user, saved, signOut, authOpen, setAuthOpen, notice } = useApp();
  return <>
    <header className="site-header"><div className="header-inner">
      <Link className="brand" to="/" aria-label="RentCheck home"><span className="brand-icon"><House size={21} strokeWidth={1.8} /><Check size={11} className="brand-check" strokeWidth={3} /></span>rentcheck<span className="brand-dot">.</span></Link>
      <nav className="main-nav" aria-label="Main navigation"><NavLink to="/" end>Find a place</NavLink><NavLink to="/saved"><Heart size={15} />Saved{user && saved.length > 0 && <span className="nav-count">{saved.length}</span>}</NavLink><NavLink to="/my-listings">My listings</NavLink></nav>
      <div className="header-actions">{user ? <button className="sign-in" onClick={() => void signOut()} title={`Sign out ${user.email}`}><LogOut size={16} /><span>Sign out</span></button> : <button className="sign-in" onClick={() => setAuthOpen(true)}>Log in</button>}<Link className="button primary header-post" to="/listings/new"><Plus size={16} /><span>List your place</span></Link></div>
    </div></header>
    <main><Outlet /></main>
    <footer className="site-footer"><div><Link className="footer-brand" to="/">rentcheck.</Link><p>A fresh start. A place to call yours.</p></div><div className="footer-right"><span>Made for your next move.</span><span>© {new Date().getFullYear()} RentCheck{isDemo && <span className="demo-pill">Demo</span>}</span></div></footer>
    {notice && <div className={`toast ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.error ? <X size={18} /> : <Check size={18} />}{notice.text}</div>}
    {authOpen && <AuthModal />}
  </>;
}

export function EmptyState({ title, description, action, to = '/', onClick }: { title: string; description: string; action: string; to?: string; onClick?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><House size={28} strokeWidth={1.5} /></span><h2>{title}</h2><p>{description}</p>{onClick ? <button className="button primary" onClick={onClick}>{action}<ArrowUpRight size={16} /></button> : <Link className="button primary" to={to}>{action}<ArrowUpRight size={16} /></Link>}</div>;
}
