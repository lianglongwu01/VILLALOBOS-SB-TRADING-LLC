import { database, checkDatabase } from './db.js';
import { HttpError, integer, pageOf, pagination, readJson, uuid } from './http.js';
import { matchOpenId, requireSession } from './session.js';

const pgIntegerMax = 2147483647;
const progressFields = 'drama_id,episode_num,progress_seconds,updated_at';

export async function saveProgress(request: Request) {
  const openid = await requireSession(request);
  const body = await readJson(request);
  matchOpenId(body.openid, openid);
  const dramaId = uuid(body.drama_id, 'drama_id');
  const episode = integer(body.episode_num, 'episode_num', 1, pgIntegerMax);
  const seconds = integer(body.progress_seconds, 'progress_seconds', 0, pgIntegerMax);
  const db = database();

  const available = await db.from('episodes').select('episode_num,dramas!episodes_drama_id_fkey!inner(is_published)')
    .eq('drama_id', dramaId).eq('episode_num', episode).eq('dramas.is_published', true)
    .maybeSingle();
  checkDatabase(available.error, 'findPublishedEpisode');
  if (!available.data) throw new HttpError(404, 'EPISODE_NOT_FOUND', 'The episode is unavailable.');

  const { data, error } = await db.from('user_playback_history').upsert({
    openid,
    drama_id: dramaId,
    episode_num: episode,
    progress_seconds: seconds,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'openid,drama_id,episode_num' }).select(progressFields).single();
  if (error?.code === '23503') throw new HttpError(404, 'EPISODE_NOT_FOUND', 'The episode is unavailable.');
  checkDatabase(error, 'saveProgress');
  return { data };
}

export async function getProgress(request: Request, params: URLSearchParams) {
  const openid = await requireSession(request);
  matchOpenId(params.get('openid'), openid);
  const page = pagination(params);
  const db = database();
  const [history, latest] = await Promise.all([
    db.from('user_playback_history')
      .select(progressFields + ',drama:dramas!user_playback_history_drama_id_fkey!inner(id,title,cover_url,total_episodes)')
      .eq('openid', openid).eq('drama.is_published', true)
      .order('updated_at', { ascending: false }).order('drama_id').order('episode_num')
      .range(page.offset, page.offset + page.limit),
    db.rpc('get_continue_watching', { p_openid: openid }),
  ]);
  checkDatabase(history.error, 'getPlaybackHistory');
  checkDatabase(latest.error, 'getContinueWatching');
  const result = pageOf(history.data ?? [], page);
  return { data: { continue_watching: latest.data ?? [], history: result.data }, pagination: result.pagination };
}
