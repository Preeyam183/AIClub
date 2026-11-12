import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import { Layout } from '../components/Layout';
import { AuthModal } from '../components/AuthModal';
import { BrowsePage } from './BrowsePage';
import { ListingPage } from './ListingPage';
import { ListingFormPage } from './ListingFormPage';
import { MyListingsPage } from './MyListingsPage';
import { SavedPage } from './SavedPage';
import { DEMO_USER_ID, demoListings } from '../data/demo';

// Keep page tests deterministic and offline even after a developer adds real
// project credentials to .env.local.
vi.mock('../lib/supabase', () => ({ isDemo: true, supabase: null }));

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

function render(path: string) {
  return renderToString(<MemoryRouter initialEntries={[path]}><AppProvider><Routes><Route element={<Layout />}><Route index element={<BrowsePage />} /><Route path="listings/new" element={<ListingFormPage />} /><Route path="listings/:id" element={<ListingPage />} /><Route path="listings/:id/edit" element={<ListingFormPage />} /><Route path="my-listings" element={<MyListingsPage />} /><Route path="saved" element={<SavedPage />} /></Route></Routes></AppProvider></MemoryRouter>);
}
function signIn() { localStorage.setItem('rentcheck-user-v1', JSON.stringify({ id: DEMO_USER_ID, email: 'you@example.com' })); }

describe('page rendering', () => {
  it('renders the marketplace with all six sample listings', () => {
    const html = render('/');
    for (const item of demoListings) expect(html).toContain(item.title);
    expect(html).toContain('Sample places');
    expect(html).toContain('Search city, neighborhood, or address');
  });
  it('opens every sample listing directly and handles missing listings', () => {
    for (const item of demoListings) {
      const html = render(`/listings/${item.id}`);
      expect(html).toContain(item.address);
      expect(html).toContain('Contact the owner');
    }
    expect(render('/listings/missing')).toContain('This door has closed.');
  });
  it('gates saved places, posting, and management behind sign-in', () => {
    expect(render('/saved')).toContain('Make room for your favorites.');
    expect(render('/listings/new')).toContain('Sign in to get started');
    expect(render('/my-listings')).toContain('Let’s get you settled in.');
  });
  it('shows a signed-in user the post form and their saved places', () => {
    signIn();
    expect(render('/listings/new')).toContain('Publish your place');
    localStorage.setItem('rentcheck-saved-v1', JSON.stringify(['maple-loft']));
    const html = render('/saved');
    expect(html).toContain(demoListings[0].title);
    expect(html).not.toContain(demoListings[1].title);
  });
  it('blocks editing someone else’s place and shows only owned listings', () => {
    signIn();
    expect(render('/listings/maple-loft/edit')).toContain('This listing isn’t yours to edit.');
    localStorage.setItem('rentcheck-listings-v1', JSON.stringify(demoListings.map((item, index) => index === 0 ? { ...item, owner_id: DEMO_USER_ID } : item)));
    expect(render('/listings/maple-loft/edit')).toContain('Save changes');
    const html = render('/my-listings');
    expect(html).toContain(demoListings[0].title);
    expect(html).not.toContain(demoListings[1].title);
  });
  it('clearly labels demo sign-in without pretending to send an email', () => {
    const html = renderToString(<MemoryRouter><AppProvider><AuthModal /></AppProvider></MemoryRouter>);
    expect(html).toContain('Continue with demo account');
    expect(html).toContain('No email is sent.');
  });
});
