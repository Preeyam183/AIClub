import { describe, expect, it } from 'vitest';
import { demoListings } from '../data/demo';
import { defaultFilters, filterListings, validateListing } from './listings';

describe('apartment search', () => {
  it('combines case-insensitive location, listing type, price, and amenities', () => {
    const results = filterListings(demoListings, { ...defaultFilters, query: 'COLLEGE avenue', type: 'Sublease', maxPrice: '1500', furnished: true });
    expect(results.map(item => item.id)).toEqual(['college-avenue']);
  });
  it('treats studio as zero bedrooms and 3+ as at least three', () => {
    expect(filterListings(demoListings, { ...defaultFilters, beds: '0' }).map(item => item.id)).toEqual(['george-studio']);
    expect(filterListings(demoListings, { ...defaultFilters, beds: '3' }).map(item => item.id)).toEqual(['park-apartment']);
  });
  it('requires the requested move-in date to fit the complete availability range', () => {
    expect(filterListings(demoListings, { ...defaultFilters, moveIn: '2026-11-15' })).toHaveLength(0);
    expect(filterListings(demoListings, { ...defaultFilters, moveIn: '2027-06-30', type: 'Sublease' }).map(item => item.id)).toContain('college-avenue');
    expect(filterListings(demoListings, { ...defaultFilters, moveIn: '2027-07-01', type: 'Sublease' }).map(item => item.id)).not.toContain('college-avenue');
  });
  it('excludes rented places even if they match other filters', () => {
    expect(filterListings([{ ...demoListings[0], status: 'rented' }], defaultFilters)).toEqual([]);
  });
  it('sorts numeric prices in both directions without changing the input', () => {
    const original = demoListings.map(item => item.id);
    expect(filterListings(demoListings, { ...defaultFilters, sort: 'price-asc' })[0].price).toBe(1200);
    expect(filterListings(demoListings, { ...defaultFilters, sort: 'price-desc' })[0].price).toBe(2850);
    expect(demoListings.map(item => item.id)).toEqual(original);
  });
  it('returns no matches for an unknown city', () => {
    expect(filterListings(demoListings, { ...defaultFilters, query: 'Seattle' })).toEqual([]);
  });
});

describe('listing validation', () => {
  it('accepts studios and half baths', () => {
    expect(validateListing({ ...demoListings[0], beds: 0, baths: 1.5 })).toBeNull();
  });
  it('rejects negative rent, invalid dimensions, and non-numeric values', () => {
    expect(validateListing({ ...demoListings[0], price: -1 })).toBeTruthy();
    expect(validateListing({ ...demoListings[0], price: NaN })).toBeTruthy();
    expect(validateListing({ ...demoListings[0], beds: 1.5 })).toBeTruthy();
    expect(validateListing({ ...demoListings[0], baths: 1.3 })).toBeTruthy();
    expect(validateListing({ ...demoListings[0], sqft: 0 })).toBeTruthy();
  });
  it('rejects inverted availability dates', () => {
    expect(validateListing({ ...demoListings[0], available_to: '2026-11-01' })).toContain('end date');
  });
});
