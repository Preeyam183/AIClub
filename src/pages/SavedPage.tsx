import { Heart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ListingCard } from '../components/ListingCard';
import { EmptyState } from '../components/Layout';

export function SavedPage() {
  const { user, saved, listings, setAuthOpen, loading, loadError, refresh } = useApp();
  const places = listings.filter(item => saved.includes(item.id) && item.status === 'published');
  return <div className="page-width interior-page"><p className="eyebrow"><Heart size={14} /> YOUR SHORTLIST</p><h1>Keep the good ones close.</h1><p className="page-description">A few favorites for your next chapter.</p>
    {!user ? <EmptyState title="Make room for your favorites." description="Sign in to save the places you love and come back to them later." action="Sign in" onClick={() => setAuthOpen(true)} /> : loadError ? <EmptyState title="We couldn’t load your saved places." description={loadError} action="Try again" onClick={() => void refresh()} /> : loading ? <p className="loading-text">Loading saved places…</p> : places.length ? <><p className="results-count">{places.length} saved {places.length === 1 ? 'place' : 'places'}</p><div className="listing-grid">{places.map(listing => <ListingCard key={listing.id} listing={listing} />)}</div></> : <EmptyState title="Your next home could be a heart away." description="Tap the heart on a listing to keep it here. Only available places appear in your shortlist." action="Explore places" />}
  </div>;
}
