-- OFUSCA Supabase starter schema.
-- Run this only after creating a Supabase project.
-- IMPORTANT: enable Row Level Security and test policies before storing real member data.

create extension if not exists "uuid-ossp";

create table if not exists public.member_profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  preferred_name text,
  gender text,
  date_of_birth date,
  birthday_month text,
  birthday_day int check (birthday_day between 1 and 31),
  marital_status text,
  spouse_name text,
  number_of_children int,
  children_names_ages text,
  ama_kindred text,
  branch text,
  membership_status text default 'Prospective Member',
  year_joined text,
  phone text,
  whatsapp text,
  email text unique,
  city text,
  state_province text,
  country text,
  profession text,
  employer_business text,
  industry text,
  professional_bio text,
  business_description text,
  website text,
  linkedin text,
  facebook text,
  instagram text,
  tiktok_youtube text,
  likes_interests text,
  consent_records boolean default false,
  consent_publicity boolean default false,
  contact_before_public_use boolean default true,
  privacy_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.member_roles (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid references public.member_profiles(id) on delete cascade,
  role text not null check (role in ('member','executive','admin','treasurer','financial_secretary','pro','secretary','welfare','committee_lead')),
  created_at timestamptz default now()
);

create table if not exists public.dues_donations (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid references public.member_profiles(id) on delete set null,
  payment_type text not null,
  amount numeric(12,2),
  currency text default 'USD',
  payment_method text,
  payment_reference text,
  payment_date date,
  verification_status text default 'Needs Verification',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.member_spotlights (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid references public.member_profiles(id) on delete set null,
  title text,
  details text,
  preferred_platform text,
  consent_confirmed boolean default false,
  status text default 'Needs Review',
  approved_by uuid references public.member_profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null,
  audience text default 'members',
  created_by uuid references public.member_profiles(id) on delete set null,
  created_at timestamptz default now(),
  published_at timestamptz
);

alter table public.member_profiles enable row level security;
alter table public.member_roles enable row level security;
alter table public.dues_donations enable row level security;
alter table public.member_spotlights enable row level security;
alter table public.announcements enable row level security;

-- Basic member policy: members can view/update their own profile.
-- Admin/executive policies should be added after officer roles are created and tested.
create policy "Members can view own profile" on public.member_profiles
  for select using (auth.uid() = auth_user_id);

create policy "Members can update own profile" on public.member_profiles
  for update using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy "Members can insert own profile" on public.member_profiles
  for insert with check (auth.uid() = auth_user_id);
