-- Test database only. demo_* values are intentionally not playable BytePlus video IDs.
begin;

insert into public.dramas
  (id, title, description, cover_url, tags, total_episodes, is_trending, is_published)
values
  ('11111111-1111-4111-8111-111111111111', 'The Second Take',
   'A film editor and a former co-star must finish an abandoned project together.',
   'https://placehold.co/480x720/1a2434/ffffff.png?text=The+Second+Take',
   array['romance','workplace'], 3, true, true),
  ('22222222-2222-4222-8222-222222222222', 'The Last Frame',
   'An archivist finds a clue in an old photograph that changes a missing-person case.',
   'https://placehold.co/480x720/252c32/ffffff.png?text=The+Last+Frame',
   array['suspense','mystery'], 2, false, true)
on conflict (id) do nothing;

insert into public.episodes (drama_id, episode_num, title, byteplus_vid, is_free)
values
  ('11111111-1111-4111-8111-111111111111', 1, 'The Call Sheet', 'demo_second_take_01', true),
  ('11111111-1111-4111-8111-111111111111', 2, 'Back on Set', 'demo_second_take_02', false),
  ('11111111-1111-4111-8111-111111111111', 3, 'Final Cut', 'demo_second_take_03', false),
  ('22222222-2222-4222-8222-222222222222', 1, 'A Familiar Face', 'demo_last_frame_01', true),
  ('22222222-2222-4222-8222-222222222222', 2, 'The Negative', 'demo_last_frame_02', false)
on conflict (drama_id, episode_num) do nothing;

commit;
