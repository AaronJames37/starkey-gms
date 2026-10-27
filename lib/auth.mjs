import { hosted, designPreview, getPool } from './storage.mjs';

let auth, ready, migration;
export const staffEmails = () => (process.env.STAFF_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
function configured() { return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET?.length >= 32 && process.env.BETTER_AUTH_URL && staffEmails().length); }
function unavailable() { return Object.assign(new Error('Hosted sign-in is not configured yet.'), { status: 503 }); }
export async function getAuth() {
  if (!configured()) throw unavailable();
  if (auth) return auth;
  ready ||= (async () => {
    const { betterAuth } = await import('better-auth');
    const { APIError } = await import('better-auth/api');
    const instance = betterAuth({
      appName: 'G & J Starkey',
      database: await getPool(),
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL,
      trustedOrigins: [new URL(process.env.BETTER_AUTH_URL).origin],
      emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
      session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60 },
      rateLimit: { enabled: true, storage: 'database', window: 60, max: 20 },
      advanced: { useSecureCookies: new URL(process.env.BETTER_AUTH_URL).protocol === 'https:' },
      databaseHooks: {
        user: { create: { before: async user => {
          if (!staffEmails().includes(user.email.toLowerCase())) throw new APIError('FORBIDDEN', { message: 'This account is not authorised for the workshop.' });
          return { data: user };
        } } }
      }
    });
    auth = instance;
    return instance;
  })().catch(e => { ready = undefined; throw e; });
  return ready;
}
export async function migrateAuth() {
  migration ||= (async () => {
    const instance = await getAuth();
    const { getMigrations } = await import('better-auth/db/migration');
    const { runMigrations } = await getMigrations(instance.options);
    await runMigrations();
  })().catch(e => { migration = undefined; throw e; });
  return migration;
}
// Used only by the operator's local provisioning script, never an HTTP route.
export async function createStaffAccount(input) {
  const instance = await getAuth();
  const { betterAuth } = await import('better-auth');
  const provisioner = betterAuth({ ...instance.options, emailAndPassword: { ...instance.options.emailAndPassword, disableSignUp: false } });
  return provisioner.api.signUpEmail({ body: input });
}
export async function authStatus(req) {
  if (!hosted) return { mode: 'local-preview', authenticated: true, name: 'Starkey workshop' };
  if (designPreview) return { mode: 'design-preview', authenticated: true, readOnly: true, name: 'Sample workshop' };
  if (!configured()) return { mode: 'hosted', configured: false, authenticated: false };
  const { fromNodeHeaders } = await import('better-auth/node');
  const session = await (await getAuth()).api.getSession({ headers: fromNodeHeaders(req.headers) });
  const allowed = session && staffEmails().includes(session.user.email.toLowerCase());
  return { mode: 'hosted', configured: true, authenticated: Boolean(allowed), name: allowed ? session.user.name : undefined };
}
export async function requireStaff(req) {
  if (!hosted) return;
  if (designPreview) {
    if (req.method === 'GET') return;
    throw Object.assign(new Error('Connect Supabase and staff sign-in to save changes. This is a read-only design preview.'), { status: 503 });
  }
  if (!configured()) throw unavailable();
  const status = await authStatus(req);
  if (!status.authenticated) throw Object.assign(new Error('Please sign in to the workshop.'), { status: 401 });
}
export async function authHandler(req, res) {
  if (!hosted) { res.writeHead(404); res.end(); return; }
  const { toNodeHandler } = await import('better-auth/node');
  return toNodeHandler(await getAuth())(req, res);
}

