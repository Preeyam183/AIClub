import type { Filters, Listing } from '../types';

export const defaultFilters: Filters = { query: '', type: 'All places', maxPrice: '', beds: '', moveIn: '', furnished: false, pets: false, sort: 'recommended' };
export const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
export const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const bedroomLabel = (beds: number) => beds === 0 ? 'Studio' : `${beds} bed${beds > 1 ? 's' : ''}`;

export function filterListings(listings: Listing[], filters: Filters): Listing[] {
  const query = filters.query.trim().toLowerCase();
  return listings.filter(item => item.status === 'published')
    .filter(item => !query || [item.title, item.city, item.state, item.neighborhood, item.address].some(value => value.toLowerCase().includes(query)))
    .filter(item => filters.type === 'All places' || item.listing_type === filters.type)
    .filter(item => !filters.maxPrice || item.price <= Number(filters.maxPrice))
    .filter(item => !filters.beds || (filters.beds === '3' ? item.beds >= 3 : item.beds === Number(filters.beds)))
    .filter(item => !filters.moveIn || (item.available_from <= filters.moveIn && (!item.available_to || item.available_to >= filters.moveIn)))
    .filter(item => !filters.furnished || item.amenities.includes('Furnished'))
    .filter(item => !filters.pets || item.amenities.includes('Pet friendly'))
    .sort((a, b) => filters.sort === 'price-asc' ? a.price - b.price : filters.sort === 'price-desc' ? b.price - a.price : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function validateListing(listing: Pick<Listing, 'price' | 'beds' | 'baths' | 'sqft' | 'available_from' | 'available_to'>): string | null {
  if (!Number.isInteger(listing.price) || listing.price <= 0 || listing.price > 100000) return 'Enter a monthly rent in whole dollars between $1 and $100,000.';
  if (!Number.isInteger(listing.beds) || listing.beds < 0 || listing.beds > 20) return 'Enter a valid number of bedrooms.';
  if (!Number.isFinite(listing.baths) || listing.baths < 0.5 || listing.baths > 20 || listing.baths % 0.5 !== 0) return 'Enter bathrooms in half-bath increments.';
  if (!Number.isInteger(listing.sqft) || listing.sqft <= 0 || listing.sqft > 100000) return 'Enter a valid floor area.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(listing.available_from) || !Number.isFinite(Date.parse(listing.available_from))) return 'Choose an available-from date.';
  if (listing.available_to && listing.available_to < listing.available_from) return 'The end date must be on or after the start date.';
  return null;
}
