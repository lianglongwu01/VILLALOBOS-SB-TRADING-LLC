import { database, checkDatabase } from './db.js';
import { HttpError, pageOf, pagination, uuid } from './http.js';

const dramaFields = 'id,title,description,cover_url,tags,total_episodes,is_trending';

export async function listDramas(params: URLSearchParams) {
  const tag = params.get('tag')?.trim().toLowerCase();
  if (tag !== undefined && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(tag)) {
    throw new HttpError(400, 'INVALID_TAG', 'tag must be a nonempty slug up to 64 characters.');
  }
  const page = pagination(params);
  let query = database().from('dramas').select(dramaFields).eq('is_published', true);
  if (tag) query = query.contains('tags', [tag]);
  const { data, error } = await query
    .order('is_trending', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .range(page.offset, page.offset + page.limit);
  checkDatabase(error, 'listDramas');
  return pageOf(data ?? [], page);
}

export async function dramaDetail(rawId: string) {
  const id = uuid(rawId, 'id');
  const { data, error } = await database().from('dramas')
    .select(dramaFields + ',episodes!episodes_drama_id_fkey(episode_num,title,byteplus_vid,is_free)')
    .eq('id', id).eq('is_published', true)
    .order('episode_num', { referencedTable: 'episodes', ascending: true })
    .maybeSingle();
  checkDatabase(error, 'dramaDetail');
  if (!data) throw new HttpError(404, 'DRAMA_NOT_FOUND', 'The drama is unavailable.');
  return { data };
}
