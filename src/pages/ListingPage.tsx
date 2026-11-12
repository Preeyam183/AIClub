import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bath, BedDouble, CalendarDays, Check, ChevronLeft, ChevronRight, Heart, Mail, MapPin, Scan, Send } from 'lucide-react';
import { useApp, errorText } from '../context/AppContext';
import { bedroomLabel, dateLabel, money } from '../lib/listings';
import { isDemo } from '../lib/supabase';
import { EmptyState } from '../components/Layout';
import { Modal } from '../components/Modal';

export function ListingPage() {
  const { id } = useParams();
  const { listings, loading, loadError, refresh, saved, toggleSaved, user, setAuthOpen, inquiries, sendInquiry } = useApp();
  const listing = listings.find(item => item.id === id);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [message, setMessage] = useState('Hi! I’m interested in your place. Is it still available? I’d love to learn more and arrange a viewing.');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <div className="page-width interior-page loading-text">Opening the door…</div>;
  if (loadError) return <div className="page-width interior-page"><EmptyState title="We couldn’t load this place." description={loadError} action="Try again" onClick={() => void refresh()} /></div>;
  if (!listing) return <div className="page-width interior-page"><EmptyState title="This door has closed." description="This listing may have been removed. There are more places to discover." action="Explore places" /></div>;
  const photos = listing.images.length ? listing.images : ['/images/apartment-1.jpg'];
  const isOwner = user?.id === listing.owner_id;
  const existingInquiry = inquiries.find(item => item.listing_id === listing.id && item.sender_id === user?.id);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!listing || busy) return;
    setBusy(true); setError('');
    try { await sendInquiry(listing.id, message); setSent(true); }
    catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="page-width interior-page detail-page"><div className="detail-topline"><Link className="back-link" to="/"><ArrowLeft size={16} />Back to places</Link><button className="button secondary" onClick={() => void toggleSaved(listing.id)} aria-pressed={saved.includes(listing.id)}><Heart size={16} fill={saved.includes(listing.id) ? 'currentColor' : 'none'} />{saved.includes(listing.id) ? 'Saved' : 'Save place'}</button></div>
    <div className="detail-photo"><img src={photos[photoIndex] || photos[0]} alt={listing.images.length ? `${listing.title}, photo ${photoIndex + 1}` : 'Apartment interior placeholder; the owner has not added photos'} /><span className={`type-badge ${listing.listing_type.toLowerCase()}`}>{listing.listing_type}</span>{photos.length > 1 && <><button aria-label="Previous photo" className="photo-arrow prev" onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)}><ChevronLeft /></button><button aria-label="Next photo" className="photo-arrow next" onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)}><ChevronRight /></button><span className="photo-count">{photoIndex + 1} / {photos.length}</span></>}{!listing.images.length && <span className="photo-count">Example image · photos coming soon</span>}</div>
    <div className="detail-columns"><div><p className="eyebrow">{listing.neighborhood || listing.city} · {listing.state}</p><h1>{listing.title}</h1><p className="detail-address"><MapPin size={16} />{listing.address}, {listing.city}, {listing.state}</p><div className="detail-facts"><span><BedDouble />{bedroomLabel(listing.beds)}</span><span><Bath />{listing.baths} bath{listing.baths > 1 ? 's' : ''}</span><span><Scan />{listing.sqft.toLocaleString()} sqft</span></div>
      <section className="detail-section"><h2>A little about this place.</h2><p className="description-text">{listing.description}</p></section><section className="detail-section"><h2>The little things that make a home.</h2>{listing.amenities.length ? <div className="amenities-grid">{listing.amenities.map(amenity => <span key={amenity}><Check size={17} />{amenity}</span>)}</div> : <p className="muted">Ask the owner about amenities.</p>}</section><section className="detail-section"><h2>Make your move.</h2><p className="availability"><CalendarDays size={19} />Available {dateLabel(listing.available_from)}{listing.available_to && ` through ${dateLabel(listing.available_to)}`}</p></section>
    </div><aside className="contact-card"><p className="contact-price">{money(listing.price)}<span> / month</span></p><p className="muted">{listing.listing_type === 'Sublease' ? 'A place for your in-between.' : 'A place for your next chapter.'}</p><div className="contact-host"><span className="avatar">{listing.host_name.slice(0, 1).toUpperCase()}</span><div>Listed by <strong>{listing.host_name}</strong><small>{listing.listing_type === 'Sublease' ? 'Current tenant' : 'Listing host'}</small></div></div>{listing.status === 'rented' ? <p className="status-note">This place has found its next chapter. It’s no longer available.</p> : isOwner ? <Link className="button primary wide" to={`/listings/${listing.id}/edit`}>Edit your listing<ArrowRight size={16} /></Link> : <button className="button primary wide" onClick={() => { if (!user) setAuthOpen(true); else { setContactOpen(true); setSent(Boolean(existingInquiry)); } }}><Mail size={17} />{existingInquiry ? 'View your inquiry' : 'Contact the owner'}</button>}<p className="fine-print">Arrange a viewing and discuss lease details directly with the owner.</p>{isDemo && <p className="demo-note">Sample listing · Demo inquiries stay in this browser.</p>}</aside></div>
    {contactOpen && <Modal title="Contact the owner" onClose={() => setContactOpen(false)}><span className="modal-symbol">{sent ? <Check /> : <Send />}</span><p className="eyebrow">SAY HELLO TO YOUR NEXT PLACE</p><h2>{sent ? isDemo ? 'Your demo inquiry is saved.' : 'Your inquiry is on its way.' : `Hello, ${listing.host_name.split(' ')[0]}.`}</h2>{sent ? <><p className="muted">{isDemo ? 'This is a sample listing, so no real owner has been contacted.' : 'The owner can see your message in My listings and reply to your account email.'}</p><blockquote className="inquiry-preview">{existingInquiry?.message || message}</blockquote><button className="button primary wide" onClick={() => setContactOpen(false)}>Back to the place<ArrowRight size={16} /></button></> : <form onSubmit={submit}><p className="muted">Ask a question or introduce yourself. Your account email will be shared with the owner so they can reply.</p><label className="field">Your message<textarea required minLength={10} maxLength={2000} rows={5} value={message} onChange={event => setMessage(event.target.value)} /></label><p className="fine-print">Reply to: {user?.email}</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary wide" disabled={busy}>{busy ? 'Sending…' : isDemo ? 'Save demo inquiry' : 'Send inquiry'}<Send size={16} /></button></form>}</Modal>}
  </div>;
}
