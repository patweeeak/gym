-- Member features: workout sets (inside workoutLogs docs), body measurements, progress photos,
-- gym challenges with a leaderboard.

-- who may write the new collections
create or replace function public.can_write(col text, owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.auth_role()
    when 'admin' then true
    when 'instructor' then col in ('plans', 'notes', 'classes', 'announcements', 'checkins', 'goals', 'weights',
      'workoutLogs', 'measurements', 'challenges')
    when 'member' then owner = auth.uid()
      and col in ('weights', 'meals', 'water', 'sessions', 'workoutLogs', 'bodyLab', 'goals', 'requests',
        'measurements', 'photos', 'entries')
    else false
  end
$$;

-- progress photos are private to the member: staff can't read the rows either
drop policy records_read on public.records;
create policy records_read on public.records for select to authenticated using (
  user_id = auth.uid() or user_id is null
  or (public.auth_role() in ('admin', 'instructor') and collection <> 'photos')
);

-- the photo files: a private bucket, one folder per member (<user id>/<photo id>.jpg)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_own_read on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Leaderboard of a challenge: every member who joined, with their total for the challenge's metric
-- between its start and end. Members can't read each other's records, so this runs as definer and
-- returns only a display name (first name + last initial) and the total.
create function public.challenge_leaderboard(challenge text)
returns table (user_id uuid, name text, color text, value numeric)
language sql stable security definer set search_path = public as $$
  with c as (
    select doc->>'metric' as metric, (doc->>'start')::date as s, (doc->>'end')::date as e
    from records where collection = 'challenges' and id = challenge
  ), joined as (
    select r.user_id from records r where r.collection = 'entries' and r.doc->>'challengeId' = challenge
  )
  select p.id,
    split_part(p.name, ' ', 1) || coalesce(' ' || nullif(left(split_part(p.name, ' ', 2), 1), '') || '.', ''),
    p.color,
    coalesce((
      select case c.metric
        when 'checkins' then count(*)::numeric
        when 'workouts' then count(*)::numeric
        when 'minutes'  then sum((r.doc->>'durationMin')::numeric)
        when 'steps'    then sum((r.doc->>'steps')::numeric)
        when 'distance' then sum((r.doc->>'distanceKm')::numeric)
      end
      from records r
      where r.user_id = p.id
        and r.collection = case c.metric when 'checkins' then 'checkins' when 'workouts' then 'workoutLogs'
          when 'minutes' then 'workoutLogs' else 'sessions' end
        and (case when c.metric = 'checkins' then (r.doc->>'at')::date else (r.doc->>'date')::date end) between c.s and c.e
    ), 0) as value
  from joined j join profiles p on p.id = j.user_id cross join c
  where auth.uid() is not null
  order by value desc, p.name
$$;
revoke execute on function public.challenge_leaderboard(text) from public, anon;
grant execute on function public.challenge_leaderboard(text) to authenticated;
