import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Execute the actual migration in Postgres with minimal Supabase auth/storage
// shims. These verify database constraints and RLS, not remote Auth or Storage.
const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const renter = '22222222-2222-4222-8222-222222222222';
const stranger = '33333333-3333-4333-8333-333333333333';
const listing = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function asUser(id: string | null) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.email', $2, false)", [id || '', id ? `${id}@example.com` : '']);
  await db.exec(id ? 'set role authenticated' : 'set role anon');
}

beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, aud text, role text);
    insert into auth.users(id) values ('${owner}'), ('${renter}'), ('${stranger}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb,
        jsonb_build_object('email', current_setting('request.jwt.claim.email', true)))
    $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant all on storage.objects to anon, authenticated;
  `);
  await db.exec(readFileSync(new URL('../migrations/202611070001_initial_rentcheck.sql', import.meta.url), 'utf8'));
  await asUser(owner);
  await db.query(`insert into public.rentcheck_listings
    (id,owner_id,title,description,address,city,state,price,beds,baths,sqft,listing_type,available_from,images,host_name)
    values ($1,$2,'Sunny apartment','A spacious and comfortable apartment with plenty of natural light.','42 Maple Street','New Brunswick','NJ',1800,1,1,780,'Lease','2026-12-01',array['https://example.com/photo.jpg'],'Alex')`, [listing, owner]);
}, 30000);
afterAll(async () => { await db.close(); });

describe('Supabase migration and row-level security', () => {
  it('allows anonymous browsing but rejects anonymous publishing', async () => {
    await asUser(null);
    expect((await db.query('select id from public.rentcheck_listings')).rows).toHaveLength(1);
    await expect(db.query('delete from public.rentcheck_listings where id=$1', [listing])).rejects.toThrow();
  });
  it('prevents another user from editing or deleting a listing', async () => {
    await asUser(renter);
    expect((await db.query('update public.rentcheck_listings set price=1 where id=$1 returning id', [listing])).rows).toHaveLength(0);
    expect((await db.query('delete from public.rentcheck_listings where id=$1 returning id', [listing])).rows).toHaveLength(0);
    expect((await db.query<{ price: number }>('select price from public.rentcheck_listings where id=$1', [listing])).rows[0].price).toBe(1800);
  });
  it('keeps favorites private and prevents saving as another user', async () => {
    await asUser(renter);
    await db.query('insert into public.rentcheck_favorites(user_id,listing_id) values ($1,$2)', [renter, listing]);
    await expect(db.query('insert into public.rentcheck_favorites(user_id,listing_id) values ($1,$2)', [owner, listing])).rejects.toThrow(/row-level security/);
    expect((await db.query('select * from public.rentcheck_favorites')).rows).toHaveLength(1);
    await asUser(owner);
    expect((await db.query('select * from public.rentcheck_favorites')).rows).toHaveLength(0);
  });
  it('rejects spoofed sender IDs and email addresses', async () => {
    await asUser(renter);
    const insert = 'insert into public.rentcheck_inquiries(listing_id,sender_id,sender_email,message) values ($1,$2,$3,$4)';
    await expect(db.query(insert, [listing, owner, `${renter}@example.com`, 'I would love to see your place.'])).rejects.toThrow(/row-level security/);
    await expect(db.query(insert, [listing, renter, 'someone-else@example.com', 'I would love to see your place.'])).rejects.toThrow(/row-level security/);
    await db.query(insert, [listing, renter, `${renter}@example.com`, 'I would love to see your place.']);
  });
  it('shows an inquiry only to its sender and listing owner', async () => {
    await asUser(renter);
    expect((await db.query('select * from public.rentcheck_inquiries')).rows).toHaveLength(1);
    await asUser(owner);
    expect((await db.query('select * from public.rentcheck_inquiries')).rows).toHaveLength(1);
    await asUser(stranger);
    expect((await db.query('select * from public.rentcheck_inquiries')).rows).toHaveLength(0);
    await asUser(null);
    await expect(db.query('select * from public.rentcheck_inquiries')).rejects.toThrow();
  });
  it('prevents duplicate inquiries and owners contacting themselves', async () => {
    const insert = 'insert into public.rentcheck_inquiries(listing_id,sender_id,sender_email,message) values ($1,$2,$3,$4)';
    await asUser(renter);
    await expect(db.query(insert, [listing, renter, `${renter}@example.com`, 'Here is a duplicate inquiry.'])).rejects.toThrow(/duplicate key/);
    await asUser(owner);
    await expect(db.query(insert, [listing, owner, `${owner}@example.com`, 'This is my own apartment listing.'])).rejects.toThrow(/row-level security/);
  });
  it('enforces rent and date constraints even when bypassing the form', async () => {
    await asUser(owner);
    await expect(db.query('update public.rentcheck_listings set price=-1 where id=$1', [listing])).rejects.toThrow(/check constraint/);
    await expect(db.query("update public.rentcheck_listings set available_to='2026-11-01' where id=$1", [listing])).rejects.toThrow(/check constraint/);
    await expect(db.query("update public.rentcheck_listings set images='{}' where id=$1", [listing])).rejects.toThrow(/check constraint/);
  });
  it('restricts photo writes and deletes to the user’s own folder', async () => {
    await asUser(owner);
    await db.query("insert into storage.objects(bucket_id,name) values ('rentcheck-photos',$1)", [`${owner}/${listing}/photo.jpg`]);
    await asUser(renter);
    await expect(db.query("insert into storage.objects(bucket_id,name) values ('rentcheck-photos',$1)", [`${owner}/${listing}/spoof.jpg`])).rejects.toThrow(/row-level security/);
    expect((await db.query('delete from storage.objects returning id')).rows).toHaveLength(0);
    await asUser(owner);
    expect((await db.query('delete from storage.objects returning id')).rows).toHaveLength(1);
  });
  it('hides rented listings and rejects new inquiries and favorites for them', async () => {
    await asUser(owner);
    await db.query("update public.rentcheck_listings set status='rented' where id=$1", [listing]);
    expect((await db.query('select * from public.rentcheck_listings')).rows).toHaveLength(1);
    await asUser(null);
    expect((await db.query('select * from public.rentcheck_listings')).rows).toHaveLength(0);
    await asUser(stranger);
    await expect(db.query('insert into public.rentcheck_favorites(user_id,listing_id) values ($1,$2)', [stranger, listing])).rejects.toThrow(/row-level security/);
    await expect(db.query('insert into public.rentcheck_inquiries(listing_id,sender_id,sender_email,message) values ($1,$2,$3,$4)', [listing, stranger, `${stranger}@example.com`, 'Can I view your rented apartment?'])).rejects.toThrow(/row-level security/);
  });
  it('allows the owner to delete and cascades favorites and inquiries', async () => {
    await asUser(owner);
    expect((await db.query('delete from public.rentcheck_listings where id=$1 returning id', [listing])).rows).toHaveLength(1);
    await asUser(renter);
    expect((await db.query('select * from public.rentcheck_favorites')).rows).toHaveLength(0);
    expect((await db.query('select * from public.rentcheck_inquiries')).rows).toHaveLength(0);
  });
  it('runs the live SQL test script and rolls back every synthetic Auth user', async () => {
    await db.exec('reset role');
    const before = (await db.query('select id from auth.users order by id')).rows;
    const result = await db.exec(readFileSync(new URL('./live-rls.sql', import.meta.url), 'utf8'));
    expect(JSON.stringify(result)).toContain('PASS: live renter/owner');
    expect((await db.query('select id from auth.users order by id')).rows).toEqual(before);
  });
});
