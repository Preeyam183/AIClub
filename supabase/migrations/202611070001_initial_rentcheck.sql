-- Run once in the Supabase SQL editor, or apply with `supabase db push`.
-- Namespaced tables keep RentCheck separate from existing application tables.
begin;

create table public.rentcheck_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 5 and 100),
  description text not null check (char_length(btrim(description)) between 30 and 5000),
  address text not null check (char_length(btrim(address)) between 1 and 200),
  city text not null check (char_length(btrim(city)) between 1 and 100),
  state text not null check (char_length(btrim(state)) between 1 and 50),
  neighborhood text not null default '' check (char_length(neighborhood) <= 100),
  price integer not null check (price between 1 and 100000),
  beds integer not null check (beds between 0 and 20),
  baths numeric(3,1) not null check (baths between 0.5 and 20 and mod(baths, 0.5) = 0),
  sqft integer not null check (sqft between 1 and 100000),
  listing_type text not null check (listing_type in ('Lease', 'Sublease', 'Rental')),
  available_from date not null,
  available_to date check (available_to is null or available_to >= available_from),
  amenities text[] not null default '{}',
  images text[] not null default '{}' check (cardinality(images) between 1 and 5),
  host_name text not null check (char_length(btrim(host_name)) between 2 and 80),
  status text not null default 'published' check (status in ('published', 'rented')),
  created_at timestamptz not null default now()
);

create table public.rentcheck_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.rentcheck_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.rentcheck_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.rentcheck_listings(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_email text not null check (char_length(sender_email) between 3 and 254),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  created_at timestamptz not null default now(),
  unique (listing_id, sender_id)
);

create index rentcheck_listings_owner on public.rentcheck_listings(owner_id);
create index rentcheck_listings_available on public.rentcheck_listings(created_at desc) where status = 'published';
create index rentcheck_favorites_listing on public.rentcheck_favorites(listing_id);
create index rentcheck_inquiries_listing on public.rentcheck_inquiries(listing_id);
create index rentcheck_inquiries_sender on public.rentcheck_inquiries(sender_id);

alter table public.rentcheck_listings enable row level security;
alter table public.rentcheck_favorites enable row level security;
alter table public.rentcheck_inquiries enable row level security;

create policy "Available places are public; owners can see their rented places"
  on public.rentcheck_listings for select to anon, authenticated
  using (status = 'published' or (select auth.uid()) = owner_id);
create policy "Users can publish their own places"
  on public.rentcheck_listings for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can edit their own places"
  on public.rentcheck_listings for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owners can remove their own places"
  on public.rentcheck_listings for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Saved places are private"
  on public.rentcheck_favorites for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can save available places"
  on public.rentcheck_favorites for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.rentcheck_listings where id = listing_id and status = 'published'
  ));
create policy "Users can unsave their own places"
  on public.rentcheck_favorites for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Inquiries are visible to the sender and listing owner"
  on public.rentcheck_inquiries for select to authenticated
  using ((select auth.uid()) = sender_id or exists (
    select 1 from public.rentcheck_listings where id = listing_id and owner_id = (select auth.uid())
  ));
create policy "Users can inquire about someone else's available place"
  on public.rentcheck_inquiries for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and sender_email = ((select auth.jwt()) ->> 'email')
    and exists (
      select 1 from public.rentcheck_listings
      where id = listing_id and status = 'published' and owner_id <> (select auth.uid())
    )
  );

grant select on public.rentcheck_listings to anon;
grant select, insert, update, delete on public.rentcheck_listings to authenticated;
grant select, insert, delete on public.rentcheck_favorites to authenticated;
grant select, insert on public.rentcheck_inquiries to authenticated;

-- Listing photos are public. The app uploads to <user-id>/<listing-id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rentcheck-photos', 'rentcheck-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users can upload their own listing photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'rentcheck-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can select their own photos for removal"
  on storage.objects for select to authenticated
  using (bucket_id = 'rentcheck-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can remove their own listing photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'rentcheck-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
