import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';

// ---------------------------------------------------------------------------
// S1 — google.strategy `validate` must forward an `emailVerified` boolean that
// is true ONLY when Google reports the email as verified, and must treat a
// missing email as unverified with an empty email string.
// ---------------------------------------------------------------------------

function makeConfigService(): ConfigService {
  return {
    get: jest.fn((_key: string, fallback?: unknown) => fallback),
  } as unknown as ConfigService;
}

function makeStrategy(): GoogleStrategy {
  return new GoogleStrategy(makeConfigService());
}

/** Captures the `(err, user)` passed to the passport done callback. */
function captureDone() {
  const done = jest.fn();
  return {
    done: done as unknown as (err: unknown, user?: unknown) => void,
    user: () => done.mock.calls[0]?.[1] as Record<string, unknown> | undefined,
    err: () => done.mock.calls[0]?.[0] as unknown,
  };
}

describe('GoogleStrategy.validate — email verification mapping (S1)', () => {
  it('maps emails[0].verified === true to emailVerified: true', () => {
    const strategy = makeStrategy();
    const cap = captureDone();

    strategy.validate(
      'access',
      'refresh',
      {
        id: 'g-1',
        emails: [{ value: 'user@example.com', verified: true }],
        displayName: 'User',
      } as never,
      cap.done,
    );

    const user = cap.user();
    expect(user).toMatchObject({
      googleId: 'g-1',
      email: 'user@example.com',
      name: 'User',
      emailVerified: true,
    });
  });

  it('maps _json.email_verified === true to emailVerified: true', () => {
    const strategy = makeStrategy();
    const cap = captureDone();

    strategy.validate(
      'access',
      'refresh',
      {
        id: 'g-2',
        emails: [{ value: 'user2@example.com' }],
        displayName: 'User Two',
        _json: { email_verified: true },
      } as never,
      cap.done,
    );

    expect(cap.user()).toMatchObject({
      email: 'user2@example.com',
      emailVerified: true,
    });
  });

  it('tolerates the string "true" when the library returns it', () => {
    const strategy = makeStrategy();
    const cap = captureDone();

    strategy.validate(
      'access',
      'refresh',
      {
        id: 'g-3',
        emails: [{ value: 'user3@example.com' }],
        displayName: 'User Three',
        _json: { email_verified: 'true' },
      } as never,
      cap.done,
    );

    expect(cap.user()).toMatchObject({ emailVerified: true });
  });

  it('maps an unverified email to emailVerified: false', () => {
    const strategy = makeStrategy();
    const cap = captureDone();

    strategy.validate(
      'access',
      'refresh',
      {
        id: 'g-4',
        emails: [{ value: 'user4@example.com', verified: false }],
        displayName: 'User Four',
        _json: { email_verified: false },
      } as never,
      cap.done,
    );

    expect(cap.user()).toMatchObject({
      email: 'user4@example.com',
      emailVerified: false,
    });
  });

  it('treats a missing email as unverified with an empty email', () => {
    const strategy = makeStrategy();
    const cap = captureDone();

    strategy.validate(
      'access',
      'refresh',
      {
        id: 'g-5',
        displayName: 'No Email',
      } as never,
      cap.done,
    );

    expect(cap.user()).toMatchObject({
      googleId: 'g-5',
      email: '',
      emailVerified: false,
    });
  });
});
