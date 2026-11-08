import { GoogleAuthGuard } from './google-auth.guard';

// ---------------------------------------------------------------------------
// S3 — On a failed Google auth (error, denied consent, no user), the guard must
// NOT throw a raw 401. It resolves with a falsy user so the callback route can
// redirect the browser to the friendly login error page. A successful auth
// still returns the user unchanged.
// ---------------------------------------------------------------------------

describe('GoogleAuthGuard.handleRequest (S3)', () => {
  const guard = new GoogleAuthGuard();

  it('returns the user unchanged on success', () => {
    const user = { googleId: 'g-1', email: 'a@b.com', emailVerified: true };
    expect(guard.handleRequest(null, user, undefined)).toBe(user);
  });

  it('returns null instead of throwing when passport reports an error', () => {
    expect(
      guard.handleRequest(new Error('denied'), null, 'access_denied'),
    ).toBeNull();
  });

  it('returns null instead of throwing when there is no user', () => {
    expect(guard.handleRequest(null, false, undefined)).toBeNull();
  });
});
