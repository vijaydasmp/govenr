'use client';
/**
 * components/identity-display-name.tsx
 *
 * Renders an identity as its DPNS name (e.g. "hehe.dash") when one
 * exists, falling back to whatever the caller provides (a shortened
 * identity id). User-friendly identities everywhere — no raw
 * hexadecimal where a name will do.
 *
 * Client component; lookups are cached five minutes per identity and
 * shared with every other use on the page.
 */

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/platform/session-context';
import { createPlatformClient } from '@/lib/platform/client';
import { fetchIdentityDisplayName } from '@/lib/platform/identity';

export default function IdentityDisplayName({
  identityId,
  fallback,
}: {
  identityId: string;
  fallback: string;
}) {
  const { sdk, setSdk } = useSession();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const client = sdk ?? (await createPlatformClient());
        if (!sdk) setSdk(client);
        const resolved = await fetchIdentityDisplayName(client, identityId);
        if (!cancelled) setName(resolved);
      } catch {
        // Fallback stays.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identityId, sdk, setSdk]);

  return <>{name ?? fallback}</>;
}
