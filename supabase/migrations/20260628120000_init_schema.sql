create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  company text not null,
  location text,
  url text,
  source text not null default 'manual',
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'interested',
  applied_at timestamptz,
  interview_date timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;
alter table public.applications enable row level security;

create policy "Users can read their jobs"
  on public.jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their jobs"
  on public.jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their jobs"
  on public.jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their jobs"
  on public.jobs for delete
  using (auth.uid() = user_id);

create policy "Users can read their applications"
  on public.applications for select
  using (auth.uid() = user_id);

create policy "Users can insert their applications"
  on public.applications for insert
  with check (auth.uid() = user_id);

create policy "Users can update their applications"
  on public.applications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their applications"
  on public.applications for delete
  using (auth.uid() = user_id);
