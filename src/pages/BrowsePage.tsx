import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowDownUp, ArrowRight, Check, ChevronDown, House, MapPin, Search, SlidersHorizontal, Sparkle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { defaultFilters, filterListings } from '../lib/listings';
import { isDemo } from '../lib/supabase';
import { ListingCard } from '../components/ListingCard';
import { EmptyState } from '../components/Layout';
import type { Filters } from '../types';

export function BrowsePage() {
  const { listings, loading, loadError, refresh } = useApp();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [draft, setDraft] = useState({ query: '', maxPrice: '', beds: '' });
  const [expanded, setExpanded] = useState(false);
  const results = useMemo(() => filterListings(listings, filters), [listings, filters]);
  const extraCount = Number(filters.furnished) + Number(filters.pets) + Number(Boolean(filters.moveIn));
  const hasFilters = filters.query || filters.maxPrice || filters.beds || filters.type !== 'All places' || extraCount;
  function search(event: FormEvent) {
    event.preventDefault();
    setFilters(previous => ({ ...previous, ...draft }));
    document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function reset() { setFilters(defaultFilters); setDraft({ query: '', maxPrice: '', beds: '' }); }

  return <>
    <section className="hero-section page-width">
      <div className="hero-copy"><p className="eyebrow"><span className="green-dot" /> GOOD PLACES. NEW BEGINNINGS.</p><h1>Find a place.<br /><em>Make it yours.</em></h1><p className="hero-description">A first apartment. A fresh chapter. A place for right now.<br className="desktop-break" /> Find rentals and subleases that feel like home.</p><a href="#discover" className="text-link">Let’s find your next place <ArrowRight size={17} /></a></div>
      <div className="hero-visual"><img className="hero-photo" src="/images/apartment-1.jpg" alt="A sunlit living room with warm wood furniture and comfortable seating" fetchPriority="high" /><span className="hero-photo-label"><span className="green-dot" /> A little more room for you.</span><div className="hero-note"><span><House size={20} strokeWidth={1.5} /></span><div>Your next chapter<small>starts with a place.</small></div><Sparkle size={26} strokeWidth={1.3} /></div><span className="hero-doodle" aria-hidden="true">✳</span></div>
    </section>

    <div className="search-area page-width"><form className="search-bar" onSubmit={search}>
      <label className="search-location"><span className="search-label"><MapPin size={15} /> LOCATION</span><input aria-label="Search city, neighborhood, or address" placeholder="City, neighborhood, or address" value={draft.query} onChange={event => setDraft(previous => ({ ...previous, query: event.target.value }))} /></label>
      <label><span className="search-label">MONTHLY BUDGET</span><span className="select-wrap"><select aria-label="Maximum monthly rent" value={draft.maxPrice} onChange={event => setDraft(previous => ({ ...previous, maxPrice: event.target.value }))}><option value="">Any price</option><option value="1000">Up to $1,000</option><option value="1500">Up to $1,500</option><option value="2000">Up to $2,000</option><option value="2500">Up to $2,500</option><option value="3000">Up to $3,000</option><option value="5000">Up to $5,000</option></select><ChevronDown size={15} /></span></label>
      <label><span className="search-label">BEDROOMS</span><span className="select-wrap"><select aria-label="Bedrooms" value={draft.beds} onChange={event => setDraft(previous => ({ ...previous, beds: event.target.value }))}><option value="">Any beds</option><option value="0">Studio</option><option value="1">1 bedroom</option><option value="2">2 bedrooms</option><option value="3">3+ bedrooms</option></select><ChevronDown size={15} /></span></label>
      <button className="button primary search-submit"><Search size={18} />Find a place</button>
    </form><p className="search-footnote">{isDemo ? <><span className="green-dot" /> Explore the demo · Sample places in New Brunswick, NJ and nearby.</> : <><Check size={13} /> Apartments, subleases, and fresh starts. All in one place.</>}</p></div>

    <section id="discover" className="discover-section page-width">
      <div className="section-heading"><div><p className="eyebrow">OPEN DOORS, FRESH STARTS</p><h2>Somewhere you’ll love coming home to.</h2></div><span className="section-side-note">A place for every chapter <span aria-hidden="true">↙</span></span></div>
      <div className="browse-toolbar"><div className="listing-tabs" aria-label="Listing type">{['All places', 'Lease', 'Sublease', 'Rental'].map(type => <button className={filters.type === type ? 'active' : ''} key={type} onClick={() => setFilters(previous => ({ ...previous, type }))}>{type === 'All places' && <House size={15} />}{type === 'Lease' ? 'Leases' : type === 'Sublease' ? 'Subleases' : type === 'Rental' ? 'Rentals' : type}</button>)}</div><button className={`button filter-button ${expanded ? 'selected' : ''}`} aria-expanded={expanded} aria-controls="more-filters" onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={15} />Filters{extraCount > 0 && <span className="filter-count">{extraCount}</span>}</button></div>
      {expanded && <div className="filter-panel" id="more-filters"><label className="field">Move-in date<input type="date" value={filters.moveIn} onChange={event => setFilters(previous => ({ ...previous, moveIn: event.target.value }))} /></label><label className="checkbox-label"><input type="checkbox" checked={filters.furnished} onChange={event => setFilters(previous => ({ ...previous, furnished: event.target.checked }))} />Furnished</label><label className="checkbox-label"><input type="checkbox" checked={filters.pets} onChange={event => setFilters(previous => ({ ...previous, pets: event.target.checked }))} />Pet friendly</label><button className="text-button" onClick={reset}>Reset filters</button></div>}
      <div className="results-heading"><p>{loading ? 'Finding your next place…' : <><strong>{results.length}</strong> {results.length === 1 ? 'place' : 'places'} to call home{filters.query && <> near <strong>{filters.query}</strong></>}</>}{Boolean(hasFilters) && <button className="clear-filters" onClick={reset}>Clear all<X size={12} /></button>}</p><label className="sort-select"><ArrowDownUp size={13} /><select aria-label="Sort listings" value={filters.sort} onChange={event => setFilters(previous => ({ ...previous, sort: event.target.value }))}><option value="recommended">Newest first</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select><ChevronDown size={12} /></label></div>
      {loadError ? <div className="error-panel" role="alert"><h3>We couldn’t load the listings.</h3><p>{loadError}</p><p>Check your Supabase connection and run the migration in the repo if this is your first setup.</p><button className="button secondary" onClick={() => void refresh()}>Try again</button></div> : loading ? <div className="listing-grid">{[1, 2, 3].map(number => <div className="skeleton-card" key={number}><div /><span /><span /></div>)}</div> : results.length ? <div className="listing-grid">{results.map(listing => <ListingCard listing={listing} key={listing.id} />)}</div> : <EmptyState title={hasFilters ? 'A different search might open a door.' : 'The first place could be yours.'} description={hasFilters ? 'Try another neighborhood, a wider budget, or fewer filters.' : 'There aren’t any available listings yet. Share a place to get things started.'} action={hasFilters ? 'Reset filters' : 'List your place'} onClick={hasFilters ? reset : undefined} to="/listings/new" />}
    </section>
    <section className="list-banner page-width"><div className="banner-illustration" aria-hidden="true"><House size={49} strokeWidth={1.1} /><span>✳</span></div><div><p className="eyebrow">GOOD PLACES DESERVE GOOD PEOPLE</p><h2>Have a place? Open the door.</h2><p>Find someone who’ll feel right at home.</p></div><Link className="button primary" to="/listings/new">List your place<ArrowRight size={17} /></Link></section>
  </>;
}
