-- IronPulse Gym schema.
-- Accounts live in auth.users (Supabase Auth); `profiles` holds the app's user record.
-- Every other collection of the app's DB (goals, meals, classes, ...) is a row in `records`:
-- `doc` is the object exactly as the app uses it, `user_id` / `coach_id` scope it for row-level security.

create table public.settings (
  id int primary key default 1 check (id = 1),
  gym_name text not null default 'IronPulse Gym',
  monthly_price numeric not null default 1500,
  day_pass_price numeric not null default 100,
  currency text not null default '₱'
);
insert into public.settings (id) values (1);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'instructor', 'member')),
  name text not null,
  email text not null,
  phone text,
  color text not null default '#ff6a3d',
  created_at timestamptz not null default now(),
  plan text check (plan in ('monthly', 'basic')),
  subscription_end date,
  instructor_id uuid references public.profiles (id) on delete set null,
  specialty text
);

create table public.records (
  collection text not null,
  id text not null,
  user_id uuid references public.profiles (id) on delete cascade,
  coach_id uuid references public.profiles (id) on delete set null,
  doc jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index records_user_idx on public.records (user_id);
-- realtime deletes carry the whole old row (collection, id, user_id), not just the key
alter table public.records replica identity full;
alter table public.profiles replica identity full;

-- the caller's role (security definer: reads profiles without tripping its own policies)
create function public.auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.records enable row level security;

-- settings: anyone may read (the login page shows the gym name); only the owner edits
create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_write on public.settings for update to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

-- profiles: staff see everyone; members see themselves and the staff
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or role in ('admin', 'instructor') or public.auth_role() in ('admin', 'instructor')
);
create policy profiles_update on public.profiles for update to authenticated
  using (public.auth_role() = 'admin' or id = auth.uid())
  with check (public.auth_role() = 'admin' or id = auth.uid());
-- (accounts are created and deleted by the manage-users edge function with the service role)

-- members may only change their own name, phone and colour
create function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.auth_role() = 'admin' then return new; end if;
  if new.role is distinct from old.role or new.email is distinct from old.email
     or new.plan is distinct from old.plan or new.subscription_end is distinct from old.subscription_end
     or new.instructor_id is distinct from old.instructor_id or new.specialty is distinct from old.specialty then
    raise exception 'Only the owner can change this.';
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile();

-- records: staff read everything; members read their own rows and the gym-wide ones (classes, news)
create policy records_read on public.records for select to authenticated using (
  public.auth_role() in ('admin', 'instructor') or user_id = auth.uid() or user_id is null
);

-- what each role may write
create function public.can_write(col text, owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.auth_role()
    when 'admin' then true
    when 'instructor' then col in ('plans', 'notes', 'classes', 'announcements', 'checkins', 'goals', 'weights', 'workoutLogs')
    when 'member' then owner = auth.uid()
      and col in ('weights', 'meals', 'water', 'sessions', 'workoutLogs', 'bodyLab', 'goals', 'requests')
    else false
  end
$$;

create policy records_insert on public.records for insert to authenticated with check (public.can_write(collection, user_id));
create policy records_update on public.records for update to authenticated
  using (public.can_write(collection, user_id) or (collection = 'classes' and public.auth_role() = 'member'))
  with check (public.can_write(collection, user_id) or (collection = 'classes' and public.auth_role() = 'member'));
create policy records_delete on public.records for delete to authenticated using (public.can_write(collection, user_id));

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger records_touch before update on public.records for each row execute function public.touch_updated_at();

-- live updates to every signed-in device (row-level security still applies)
alter publication supabase_realtime add table public.records, public.profiles, public.settings;
