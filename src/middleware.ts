import { defineMiddleware } from 'astro:middleware';
import { isAuthenticated } from './lib/session';

// Gate /admin/* except the login page and the login API endpoint.
const PUBLIC_ADMIN_PATHS = new Set<string>([
  '/admin/login',
  '/admin/login/',
  '/api/admin/google-login',
]);

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isAdminUi = path === '/admin' || path === '/admin/' || path.startsWith('/admin/');
  const isAdminApi = path.startsWith('/api/admin');

  if (!isAdminUi && !isAdminApi) return next();
  if (PUBLIC_ADMIN_PATHS.has(path)) return next();

  if (!isAuthenticated(context.cookies)) {
    if (isAdminApi) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return context.redirect('/admin/login', 302);
  }
  return next();
});
