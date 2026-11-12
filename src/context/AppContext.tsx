import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { demoListings, DEMO_USER_ID } from '../data/demo';
import { isDemo, supabase } from '../lib/supabase';
import type { Inquiry, Listing } from '../types';

type AppUser = Pick<User, 'id' | 'email'>;
type Notice = { text: string; error: boolean } | null;
interface AppState {
  user: AppUser | null;
  listings: Listing[];
  saved: string[];
  inquiries: Inquiry[];
  loading: boolean;
  loadError: string;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  notice: Notice;
  notify: (text: string, error?: boolean) => void;
  refresh: () => Promise<void>;
  toggleSaved: (id: string) => Promise<void>;
  saveListing: (listing: Listing, files: File[]) => Promise<void>;
  setStatus: (listing: Listing, status: Listing['status']) => Promise<void>;
  deleteListing: (id: string) => Promise<void>;
  sendInquiry: (listingId: string, message: string) => Promise<void>;
  demoSignIn: () => void;
  signOut: () => Promise<void>;
}
const AppContext = createContext<AppState | null>(null);

function stored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function persist(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); }
export function errorText(error: unknown) { return error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Something went wrong. Please try again.'; }

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => isDemo ? stored<AppUser | null>('rentcheck-user-v1', null) : null);
  const [listings, setListings] = useState<Listing[]>(() => isDemo ? stored('rentcheck-listings-v1', demoListings) : []);
  const [saved, setSaved] = useState<string[]>(() => isDemo ? stored('rentcheck-saved-v1', []) : []);
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => isDemo ? stored('rentcheck-inquiries-v1', []) : []);
  const [loading, setLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const saving = useRef(new Set<string>());
  const refreshVersion = useRef(0);
  const notify = useCallback((text: string, error = false) => setNotice({ text, error }), []);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) notify(error.message, true);
      setUser(data.session?.user ?? null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [notify]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const version = ++refreshVersion.current;
    setLoading(true);
    setLoadError('');
    try {
      const [listingResult, savedResult, inquiryResult] = await Promise.all([
        supabase.from('rentcheck_listings').select('*').order('created_at', { ascending: false }),
        user ? supabase.from('rentcheck_favorites').select('listing_id').eq('user_id', user.id) : Promise.resolve({ data: [], error: null }),
        user ? supabase.from('rentcheck_inquiries').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      ]);
      if (listingResult.error) throw listingResult.error;
      if (savedResult.error) throw savedResult.error;
      if (inquiryResult.error) throw inquiryResult.error;
      if (version !== refreshVersion.current) return;
      setListings((listingResult.data ?? []) as Listing[]);
      setSaved((savedResult.data ?? []).map(item => item.listing_id));
      setInquiries((inquiryResult.data ?? []) as Inquiry[]);
    } catch (error) { if (version === refreshVersion.current) setLoadError(errorText(error)); }
    finally { if (version === refreshVersion.current) setLoading(false); }
  }, [user]);
  useEffect(() => {
    if (!isDemo) { setSaved([]); setInquiries([]); setListings([]); }
    void refresh();
    return () => { refreshVersion.current += 1; };
  }, [refresh]);

  async function toggleSaved(id: string) {
    if (!user) { setAuthOpen(true); return; }
    if (saving.current.has(id)) return;
    saving.current.add(id);
    const exists = saved.includes(id);
    try {
      if (supabase) {
        const { error } = exists ? await supabase.from('rentcheck_favorites').delete().eq('user_id', user.id).eq('listing_id', id) : await supabase.from('rentcheck_favorites').insert({ user_id: user.id, listing_id: id });
        if (error) throw error;
      }
      setSaved(previous => {
        const next = exists ? previous.filter(value => value !== id) : [...previous, id];
        if (isDemo) persist('rentcheck-saved-v1', next);
        return next;
      });
      notify(exists ? 'Removed from your saved places.' : 'Added to your saved places.');
    } catch (error) { notify(errorText(error), true); }
    finally { saving.current.delete(id); }
  }

  function updateDemoListings(next: Listing[]) {
    persist('rentcheck-listings-v1', next);
    setListings(next);
  }

  function uploadedPaths(images: string[], ownerId: string) {
    if (!supabase) return [];
    const bucketUrl = supabase.storage.from('rentcheck-photos').getPublicUrl('').data.publicUrl;
    return images.flatMap(url => {
      if (!url.startsWith(bucketUrl)) return [];
      try {
        const path = decodeURIComponent(url.slice(bucketUrl.length));
        return path.startsWith(`${ownerId}/`) ? [path] : [];
      } catch { return []; }
    });
  }

  async function removePhotos(paths: string[]) {
    if (!supabase || !paths.length) return;
    try {
      const { error } = await supabase.storage.from('rentcheck-photos').remove(paths);
      if (error) notify('Your listing was saved, but some unused photos could not be removed from storage.', true);
    } catch { notify('Your listing was saved, but some unused photos could not be removed from storage.', true); }
  }

  async function saveListing(listing: Listing, files: File[]) {
    if (!user || listing.owner_id !== user.id) throw new Error('Sign in to manage your own listing.');
    const uploaded: string[] = [];
    try {
      if (supabase) {
        const urls: string[] = [];
        for (const file of files) {
          const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
          const path = `${user.id}/${listing.id}/${crypto.randomUUID()}.${extension}`;
          const { error } = await supabase.storage.from('rentcheck-photos').upload(path, file, { contentType: file.type });
          if (error) throw error;
          uploaded.push(path);
          urls.push(supabase.storage.from('rentcheck-photos').getPublicUrl(path).data.publicUrl);
        }
        const data = { ...listing, images: [...listing.images, ...urls] };
        const existing = listings.some(item => item.id === listing.id);
        const result = existing
          ? await supabase.from('rentcheck_listings').update(data).eq('id', listing.id).eq('owner_id', user.id).select('id').single()
          : await supabase.from('rentcheck_listings').insert(data).select('id').single();
        if (result.error) throw result.error;
        setListings(previous => existing ? previous.map(item => item.id === listing.id ? data : item) : [data, ...previous]);
        const removed = listings.find(item => item.id === listing.id)?.images.filter(image => !listing.images.includes(image)) ?? [];
        await removePhotos(uploadedPaths(removed, user.id));
      } else {
        const urls = await Promise.all(files.map(file => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Could not read the photo.'));
          reader.readAsDataURL(file);
        })));
        const data = { ...listing, images: [...listing.images, ...urls] };
        updateDemoListings(listings.some(item => item.id === listing.id) ? listings.map(item => item.id === listing.id ? data : item) : [data, ...listings]);
      }
    } catch (error) {
      if (supabase && uploaded.length) await supabase.storage.from('rentcheck-photos').remove(uploaded);
      throw error;
    }
  }

  async function setStatus(listing: Listing, status: Listing['status']) {
    if (!user || listing.owner_id !== user.id) throw new Error('You can only update your own listings.');
    if (supabase) {
      const { error } = await supabase.from('rentcheck_listings').update({ status }).eq('id', listing.id).eq('owner_id', user.id).select('id').single();
      if (error) throw error;
      setListings(previous => previous.map(item => item.id === listing.id ? { ...item, status } : item));
    } else updateDemoListings(listings.map(item => item.id === listing.id ? { ...item, status } : item));
    notify(status === 'rented' ? 'Listing marked as rented.' : 'Your listing is available again.');
  }

  async function deleteListing(id: string) {
    if (!user || !listings.some(item => item.id === id && item.owner_id === user.id)) throw new Error('You can only delete your own listings.');
    if (supabase) {
      const { error } = await supabase.from('rentcheck_listings').delete().eq('id', id).eq('owner_id', user.id).select('id').single();
      if (error) throw error;
      await removePhotos(uploadedPaths(listings.find(item => item.id === id)?.images ?? [], user.id));
      setListings(previous => previous.filter(item => item.id !== id));
    } else updateDemoListings(listings.filter(item => item.id !== id));
    const nextSaved = saved.filter(value => value !== id);
    const nextInquiries = inquiries.filter(value => value.listing_id !== id);
    if (isDemo) { persist('rentcheck-saved-v1', nextSaved); persist('rentcheck-inquiries-v1', nextInquiries); }
    setSaved(nextSaved);
    setInquiries(nextInquiries);
    notify('Listing deleted.');
  }

  async function sendInquiry(listingId: string, message: string) {
    if (!user?.email) throw new Error('Sign in with an email address to contact the owner.');
    const listing = listings.find(item => item.id === listingId);
    if (!listing || listing.status !== 'published') throw new Error('This place is no longer available.');
    if (listing.owner_id === user.id) throw new Error('This is your own listing.');
    if (inquiries.some(item => item.listing_id === listingId && item.sender_id === user.id)) throw new Error('You’ve already contacted the owner about this place.');
    const data: Inquiry = { id: crypto.randomUUID(), listing_id: listingId, sender_id: user.id, sender_email: user.email, message: message.trim(), created_at: new Date().toISOString() };
    if (data.message.length < 10 || data.message.length > 2000) throw new Error('Write a message between 10 and 2,000 characters.');
    if (supabase) {
      const { error } = await supabase.from('rentcheck_inquiries').insert(data);
      if (error) throw error;
    } else persist('rentcheck-inquiries-v1', [data, ...inquiries]);
    setInquiries(previous => [data, ...previous]);
  }

  function demoSignIn() {
    const demoUser = { id: DEMO_USER_ID, email: 'you@example.com' };
    persist('rentcheck-user-v1', demoUser);
    setUser(demoUser);
    setAuthOpen(false);
    notify('Demo account ready. Changes are saved in this browser.');
  }
  async function signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) { notify(error.message, true); return; }
    } else { localStorage.removeItem('rentcheck-user-v1'); }
    setUser(null);
    if (!isDemo) { setSaved([]); setInquiries([]); }
    notify('You’ve signed out.');
  }

  return <AppContext.Provider value={{ user, listings, saved, inquiries, loading, loadError, authOpen, setAuthOpen, notice, notify, refresh, toggleSaved, saveListing, setStatus, deleteListing, sendInquiry, demoSignIn, signOut }}>{children}</AppContext.Provider>;
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppProvider is missing.');
  return context;
}
