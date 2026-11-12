import { Link } from 'react-router-dom';
import { Bath, BedDouble, Heart, MapPin, MoveUpRight, Scan } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { bedroomLabel, money } from '../lib/listings';
import type { Listing } from '../types';

export function ListingCard({ listing }: { listing: Listing }) {
  const { saved, toggleSaved } = useApp();
  const isSaved = saved.includes(listing.id);
  return <article className="listing-card">
    <div className="card-image-wrap"><Link to={`/listings/${listing.id}`} className="card-image-link" tabIndex={-1} aria-hidden="true"><img src={listing.images[0] || '/images/apartment-1.jpg'} alt={listing.images.length ? listing.title : 'Apartment interior placeholder; no listing photo provided'} loading="lazy" /></Link>
      <span className={`type-badge ${listing.listing_type.toLowerCase()}`}>{listing.listing_type}</span>
      <button className={`save-button ${isSaved ? 'is-saved' : ''}`} onClick={() => void toggleSaved(listing.id)} aria-label={`${isSaved ? 'Unsave' : 'Save'} ${listing.title}`} aria-pressed={isSaved}><Heart size={18} fill={isSaved ? 'currentColor' : 'none'} /></button>
      {listing.amenities.includes('Furnished') && <span className="image-caption">Move-in ready</span>}
    </div>
    <div className="card-content"><div className="card-price"><p>{money(listing.price)}<span> / month</span></p><MoveUpRight size={18} aria-hidden="true" /></div>
      <h3><Link to={`/listings/${listing.id}`}>{listing.title}</Link></h3>
      <p className="card-address"><MapPin size={13} />{listing.neighborhood} · {listing.city}, {listing.state}</p>
      <div className="card-facts"><span><BedDouble size={15} />{bedroomLabel(listing.beds)}</span><span><Bath size={15} />{listing.baths} bath{listing.baths > 1 ? 's' : ''}</span><span><Scan size={14} />{listing.sqft.toLocaleString()} sqft</span></div>
    </div>
  </article>;
}
