import { listDramas, dramaDetail } from '../lib/dramas.js';
import { handleRequest } from '../lib/http.js';
import { getProgress, saveProgress } from '../lib/progress.js';
import { createSession } from '../lib/session.js';

export default {
  fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    if (path === '/api/dramas') {
      return handleRequest(request, ['GET'], () => listDramas(url.searchParams));
    }
    const drama = /^\/api\/dramas\/([^/]+)$/.exec(path);
    if (drama) return handleRequest(request, ['GET'], () => dramaDetail(drama[1]));
    if (path === '/api/user/progress') {
      return handleRequest(request, ['GET', 'POST'], () => request.method === 'POST'
        ? saveProgress(request)
        : getProgress(request, url.searchParams));
    }
    if (path === '/api/user/session') {
      return handleRequest(request, ['POST'], () => createSession(request));
    }
    return handleRequest(request, [], async () => null);
  },
};
