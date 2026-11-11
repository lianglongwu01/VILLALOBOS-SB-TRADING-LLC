begin;

create table public.dramas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  cover_url text not null,
  tags text[] not null default '{}',
  total_episodes integer not null check (total_episodes > 0),
  is_trending boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.episodes (
  drama_id uuid not null references public.dramas(id) on delete cascade,
  episode_num integer not null check (episode_num > 0),
  title text not null check (length(btrim(title)) > 0),
  byteplus_vid text not null check (length(btrim(byteplus_vid)) > 0),
  is_free boolean not null default false,
  primary key (drama_id, episode_num)
);

create table public.user_playback_history (
  openid text not null check (length(btrim(openid)) between 1 and 256),
  drama_id uuid not null references public.dramas(id) on delete cascade,
  episode_num integer not null,
  progress_seconds integer not null check (progress_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (openid, drama_id, episode_num),
  foreign key (drama_id, episode_num)
    references public.episodes(drama_id, episode_num) on delete cascade
);

create index dramas_published_listing_idx
  on public.dramas (is_trending desc, created_at desc, id) where is_published;
create index dramas_tags_idx on public.dramas using gin (tags) where is_published;
create index playback_history_by_user_idx
  on public.user_playback_history (openid, updated_at desc, drama_id, episode_num);
create index playback_history_latest_per_drama_idx
  on public.user_playback_history (openid, drama_id, updated_at desc, episode_num desc);
create index playback_history_episode_idx
  on public.user_playback_history (drama_id, episode_num);

alter table public.dramas enable row level security;
alter table public.episodes enable row level security;
alter table public.user_playback_history enable row level security;

revoke all on public.dramas, public.episodes, public.user_playback_history from public, anon, authenticated;
grant select on public.dramas, public.episodes to service_role;
grant select, insert, update, delete on public.user_playback_history to service_role;

-- One latest watched episode per published drama, across the user's entire history.
create function public.get_continue_watching(p_openid text)
returns table (
  drama_id uuid,
  episode_num integer,
  progress_seconds integer,
  updated_at timestamptz,
  drama jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select latest.drama_id, latest.episode_num, latest.progress_seconds, latest.updated_at,
         jsonb_build_object('id', d.id, 'title', d.title, 'cover_url', d.cover_url,
                            'total_episodes', d.total_episodes) as drama
  from (
    select distinct on (h.drama_id) h.drama_id, h.episode_num, h.progress_seconds, h.updated_at
    from public.user_playback_history h
    where h.openid = p_openid
    order by h.drama_id, h.updated_at desc, h.episode_num desc
  ) latest
  join public.dramas d on d.id = latest.drama_id and d.is_published
  order by latest.updated_at desc, latest.drama_id
  limit 20;
$$;

revoke all on function public.get_continue_watching(text) from public, anon, authenticated;
grant execute on function public.get_continue_watching(text) to service_role;

commit;
