import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, Check, X } from 'lucide-react';
import { useApp, errorText } from '../context/AppContext';
import { amenities } from '../data/demo';
import { isDemo } from '../lib/supabase';
import { validateListing } from '../lib/listings';
import { EmptyState } from '../components/Layout';
import type { Listing, ListingType } from '../types';

export function ListingFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, listings, loading, loadError, refresh, setAuthOpen, saveListing, notify } = useApp();
  const existing = listings.find(item => item.id === id);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const previews = useMemo(() => files.map(file => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);
  useEffect(() => { if (existing) { setSelectedAmenities(existing.amenities); setImages(existing.images); } }, [existing]);
  if (!user) return <div className="page-width interior-page"><EmptyState title="Open the door to someone new." description="Sign in to list your apartment, rental, or sublease and connect with potential renters." action="Sign in to get started" onClick={() => setAuthOpen(true)} /></div>;
  if (id && loading) return <div className="page-width interior-page loading-text">Loading your listing…</div>;
  if (id && loadError) return <div className="page-width interior-page"><EmptyState title="We couldn’t load your listing." description={loadError} action="Try again" onClick={() => void refresh()} /></div>;
  if (id && (!existing || existing.owner_id !== user.id)) return <div className="page-width interior-page"><EmptyState title="This listing isn’t yours to edit." description="Head to your listings to manage a place you’ve posted." action="My listings" to="/my-listings" /></div>;

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)];
    if (next.length + images.length > 5) { setError('You can add up to 5 photos.'); return; }
    if (next.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('Use JPG, PNG, or WebP photos.'); return; }
    if (next.some(file => file.size > 5 * 1024 * 1024)) { setError('Each photo must be smaller than 5 MB.'); return; }
    if (isDemo && next.reduce((total, file) => total + file.size, 0) > 2 * 1024 * 1024) { setError('For the browser demo, keep your photos under 2 MB combined.'); return; }
    setError(''); setFiles(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;
    setError('');
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? '').trim();
    const listing: Listing = {
      id: existing?.id || crypto.randomUUID(), owner_id: user.id, title: get('title'), description: get('description'), address: get('address'), city: get('city'), state: get('state').toUpperCase(), neighborhood: get('neighborhood'), price: Number(get('price')), beds: Number(get('beds')), baths: Number(get('baths')), sqft: Number(get('sqft')), listing_type: get('listing_type') as ListingType, available_from: get('available_from'), available_to: get('available_to') || null, amenities: selectedAmenities, images, host_name: get('host_name'), status: existing?.status || 'published', created_at: existing?.created_at || new Date().toISOString(),
    };
    const validation = validateListing(listing);
    if (validation) { setError(validation); return; }
    if (!listing.title || !listing.description || !listing.address || !listing.city || !listing.state || !listing.host_name) { setError('Complete the required fields before publishing.'); return; }
    if (!images.length && !files.length) { setError('Add at least one photo so renters can see your place.'); return; }
    setBusy(true);
    try { await saveListing(listing, files); notify(existing ? 'Your listing is updated.' : 'Your place is listed. Welcome to your next chapter.'); navigate(`/listings/${listing.id}`); }
    catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  }

  return <div className="page-width interior-page form-page"><Link className="back-link" to="/my-listings"><ArrowLeft size={16} />My listings</Link><p className="eyebrow">GOOD PLACES DESERVE GOOD PEOPLE</p><h1>{existing ? 'A little update for your place.' : 'Your place. Someone’s fresh start.'}</h1><p className="page-description">{existing ? 'Keep the details up to date so the right people find you.' : 'Tell people what makes it home. We’ll take care of the introduction.'}</p>
    <form onSubmit={submit} className="listing-form" key={existing?.id || 'new'}>
      <fieldset disabled={busy}><section className="form-section"><div className="form-section-heading"><span>01</span><div><h2>Start with the basics.</h2><p>Give your place a name and a little personality.</p></div></div><div className="form-fields"><label className="field">Listing title *<input name="title" required minLength={5} maxLength={100} defaultValue={existing?.title} placeholder="A sunny one-bedroom in the heart of downtown" /></label><div className="two-fields"><label className="field">Listing type *<select name="listing_type" defaultValue={existing?.listing_type || 'Lease'}><option>Lease</option><option>Sublease</option><option>Rental</option></select><small>Lease: a new lease · Sublease: take over a tenant’s place · Rental: flexible rental</small></label><label className="field">Monthly rent ($) *<input name="price" type="number" required min="1" max="100000" step="1" placeholder="1800" defaultValue={existing?.price} /></label></div><label className="field">About the place *<textarea name="description" required minLength={30} maxLength={5000} rows={5} defaultValue={existing?.description} placeholder="The light, the neighborhood, the morning coffee spot. Tell renters what they’ll love, plus lease terms and any extra costs." /></label></div></section>
      <section className="form-section"><div className="form-section-heading"><span>02</span><div><h2>Put it on the map.</h2><p>Help people find their corner of the world.</p></div></div><div className="form-fields"><label className="field">Street address *<input name="address" required maxLength={200} defaultValue={existing?.address} placeholder="42 Maple Street, Apt 2B" autoComplete="street-address" /></label><div className="two-fields"><label className="field">City *<input name="city" required maxLength={100} defaultValue={existing?.city} placeholder="New Brunswick" autoComplete="address-level2" /></label><label className="field">State or region *<input name="state" required maxLength={50} defaultValue={existing?.state} placeholder="NJ" autoComplete="address-level1" /></label></div><label className="field">Neighborhood<input name="neighborhood" maxLength={100} defaultValue={existing?.neighborhood} placeholder="Downtown" /></label><p className="field-note">Your address will be visible on the public listing.</p></div></section>
      <section className="form-section"><div className="form-section-heading"><span>03</span><div><h2>A little room for details.</h2><p>The practical things that make a place fit.</p></div></div><div className="form-fields"><div className="three-fields"><label className="field">Bedrooms *<select name="beds" defaultValue={existing?.beds ?? 1}><option value="0">Studio</option>{Array.from({ length: 20 }, (_, index) => index + 1).map(number => <option key={number} value={number}>{number}</option>)}</select></label><label className="field">Bathrooms *<input name="baths" type="number" min="0.5" max="20" step="0.5" required defaultValue={existing?.baths ?? 1} /></label><label className="field">Area (sqft) *<input name="sqft" type="number" min="1" max="100000" required placeholder="780" defaultValue={existing?.sqft} /></label></div><div className="two-fields"><label className="field">Available from *<input name="available_from" type="date" required defaultValue={existing?.available_from} /></label><label className="field">Available until<input name="available_to" type="date" defaultValue={existing?.available_to || ''} /><small>Optional for an ongoing lease.</small></label></div><label className="field">Amenities</label><div className="amenity-options">{amenities.map(amenity => <label className={selectedAmenities.includes(amenity) ? 'checked' : ''} key={amenity}><input type="checkbox" checked={selectedAmenities.includes(amenity)} onChange={event => setSelectedAmenities(previous => event.target.checked ? [...previous, amenity] : previous.filter(item => item !== amenity))} />{selectedAmenities.includes(amenity) && <Check size={13} />}{amenity}</label>)}</div></div></section>
      <section className="form-section"><div className="form-section-heading"><span>04</span><div><h2>Let your place shine.</h2><p>A few good photos make all the difference.</p></div></div><div className="form-fields"><label className="upload-zone"><Camera size={27} strokeWidth={1.5} /><strong>Choose photos of your place</strong><span>JPG, PNG, or WebP · Up to 5 photos · 5 MB each</span><input aria-label="Upload listing photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { addFiles(event.target.files); event.target.value = ''; }} /></label>{isDemo && <p className="field-note">Demo photos are stored in this browser. Keep new uploads under 2 MB combined.</p>}<div className="photo-previews">{images.map((image, index) => <div key={image}><img src={image} alt={`Existing photo ${index + 1}`} /><button type="button" aria-label={`Remove existing photo ${index + 1}`} onClick={() => setImages(previous => previous.filter((_, itemIndex) => index !== itemIndex))}><X size={14} /></button></div>)}{previews.map((image, index) => <div key={image}><img src={image} alt={`New photo ${index + 1}`} /><button type="button" aria-label={`Remove new photo ${index + 1}`} onClick={() => setFiles(previous => previous.filter((_, itemIndex) => index !== itemIndex))}><X size={14} /></button></div>)}</div></div></section>
      <section className="form-section"><div className="form-section-heading"><span>05</span><div><h2>Make the introduction.</h2><p>Let potential renters know who’s opening the door.</p></div></div><div className="form-fields"><label className="field">Your display name *<input name="host_name" required minLength={2} maxLength={80} defaultValue={existing?.host_name} placeholder="Alex Morgan" autoComplete="name" /></label><p className="field-note">Inquiries will appear in My listings. You can reply directly by email.</p></div></section>
      {error && <p className="form-error" role="alert">{error}</p>}<div className="form-bottom"><span>* Required fields{isDemo && ' · Demo: saved to this browser'}</span><button className="button primary" disabled={busy}>{busy ? 'Saving your place…' : existing ? 'Save changes' : 'Publish your place'}<ArrowRight size={17} /></button></div></fieldset>
    </form>
  </div>;
}
