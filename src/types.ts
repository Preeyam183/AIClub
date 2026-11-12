export type ListingType = 'Lease' | 'Sublease' | 'Rental';

export interface Listing {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  neighborhood: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  listing_type: ListingType;
  available_from: string;
  available_to: string | null;
  amenities: string[];
  images: string[];
  host_name: string;
  status: 'published' | 'rented';
  created_at: string;
}

export interface Inquiry {
  id: string;
  listing_id: string;
  sender_id: string;
  sender_email: string;
  message: string;
  created_at: string;
}

export interface Filters {
  query: string;
  type: string;
  maxPrice: string;
  beds: string;
  moveIn: string;
  furnished: boolean;
  pets: boolean;
  sort: string;
}
