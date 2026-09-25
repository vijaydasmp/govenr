/**
 * lib/services/session-service.ts
 *
 * SOURCE: local (fixture)
 * Swap point: v2 reads from a real Platform identity / wallet connection.
 *
 * Mock identity session for v1. Seeded from fixtures/proposals.testnet.json.
 * The session is static for the duration of a page load — no sign-in flow in v1.
 */

import type { Session } from '@/lib/types';
import fixtureData from '@/fixtures/proposals.testnet.json';

const _session: Session = {
  identityHandle: fixtureData.session.identityHandle,
  displayName: fixtureData.session.displayName,
  balanceDash: fixtureData.session.balanceDash,
};

export interface SessionService {
  getSession(): Session;
}

export const sessionService: SessionService = {
  getSession(): Session {
    return _session;
  },
};

export default sessionService;
