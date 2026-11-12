import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, ClipboardList, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp, errorText } from '../context/AppContext';
import { dateLabel, money } from '../lib/listings';
import { EmptyState } from '../components/Layout';
import { Modal } from '../components/Modal';
import type { Listing } from '../types';

export function MyListingsPage() {
  const { user, listings, inquiries, loading, loadError, refresh, setAuthOpen, setStatus, deleteListing, notify } = useApp();
  const [deleting, setDeleting] = useState<Listing | null>(null);
  const [busy, setBusy] = useState('');
  const own = listings.filter(item => item.owner_id === user?.id);
  const received = inquiries.filter(inquiry => own.some(item => item.id === inquiry.listing_id));
  async function toggleStatus(listing: Listing) {
    setBusy(listing.id);
    try { await setStatus(listing, listing.status === 'published' ? 'rented' : 'published'); }
    catch (error) { notify(errorText(error), true); }
    finally { setBusy(''); }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(deleting.id);
    try { await deleteListing(deleting.id); setDeleting(null); }
    catch (error) { notify(errorText(error), true); }
    finally { setBusy(''); }
  }
  return <div className="page-width interior-page"><div className="management-heading"><div><p className="eyebrow"><ClipboardList size={14} /> YOUR SIDE OF THE DOOR</p><h1>Your places, all in one place.</h1><p className="page-description">Manage your listings and meet the people interested in them.</p></div>{user && <Link className="button primary" to="/listings/new"><Plus size={16} />List a place</Link>}</div>
    {!user ? <EmptyState title="Let’s get you settled in." description="Sign in to post a place, manage your listings, and see your inquiries." action="Sign in" onClick={() => setAuthOpen(true)} /> : loadError ? <EmptyState title="We couldn’t load your listings." description={loadError} action="Try again" onClick={() => void refresh()} /> : loading ? <p className="loading-text">Loading your places…</p> : own.length ? <><div className="management-list">{own.map(listing => <article className="management-card" key={listing.id}><Link className="management-image" to={`/listings/${listing.id}`}><img src={listing.images[0] || '/images/apartment-1.jpg'} alt={listing.title} /></Link><div className="management-info"><span className={`status-badge ${listing.status === 'rented' ? 'rented' : ''}`}><span className="green-dot" />{listing.status === 'published' ? 'Available' : 'Rented'}</span><h2><Link to={`/listings/${listing.id}`}>{listing.title}</Link></h2><p>{listing.address} · {listing.city}, {listing.state}</p><strong>{money(listing.price)}<span> / month</span></strong></div><div className="management-actions"><Link className="button secondary" to={`/listings/${listing.id}/edit`}><Pencil size={14} />Edit</Link><button className="button secondary" disabled={busy === listing.id} onClick={() => void toggleStatus(listing)}><Check size={14} />{listing.status === 'published' ? 'Mark rented' : 'Make available'}</button><button className="icon-button delete-button" aria-label={`Delete ${listing.title}`} disabled={busy === listing.id} onClick={() => setDeleting(listing)}><Trash2 size={17} /></button></div></article>)}</div><section className="inquiries-section"><div className="section-heading"><div><p className="eyebrow">THE START OF A CONVERSATION</p><h2>Your inquiries <span className="inquiry-count">{received.length}</span></h2></div></div>{received.length ? <div className="inquiries-list">{received.map(inquiry => <article className="inquiry-card" key={inquiry.id}><div className="inquiry-top"><div><strong>{inquiry.sender_email}</strong><p>Interested in <Link to={`/listings/${inquiry.listing_id}`}>{own.find(item => item.id === inquiry.listing_id)?.title}</Link></p></div><time>{dateLabel(inquiry.created_at)}</time></div><p className="inquiry-message">{inquiry.message}</p><a className="text-link" href={`mailto:${encodeURIComponent(inquiry.sender_email)}?subject=${encodeURIComponent(`Re: ${own.find(item => item.id === inquiry.listing_id)?.title}`)}`}>Reply by email<ArrowUpRight size={15} /></a></article>)}</div> : <div className="inquiry-empty"><Mail size={24} strokeWidth={1.4} /><p>A hello could be just around the corner.</p><span>When someone contacts you about a listing, their message will appear here.</span></div>}</section></> : <EmptyState title="A fresh start for your spare space." description="Have an apartment to rent or a lease to pass on? Your first listing starts here." action="List your place" to="/listings/new" />}
    {deleting && <Modal title="Delete this listing" onClose={() => { if (!busy) setDeleting(null); }}><span className="modal-symbol"><Trash2 /></span><h2>Close this door?</h2><p className="muted">Deleting “{deleting.title}” will permanently remove the listing and its inquiries. You can mark it as rented instead if you’d like to keep it.</p><div className="modal-actions"><button className="button secondary" disabled={Boolean(busy)} onClick={() => setDeleting(null)}>Keep listing</button><button className="button danger" disabled={Boolean(busy)} onClick={() => void remove()}>{busy ? 'Deleting…' : 'Delete listing'}</button></div></Modal>}
  </div>;
}
