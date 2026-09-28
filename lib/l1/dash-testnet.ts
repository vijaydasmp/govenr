/**
 * Dash Testnet L1 governance adapter.
 *
 * This module is intentionally isolated from the rest of Govenr.
 * Govenr works with normalized Proposal objects and does not depend
 * on the shape of the upstream Dash API.
 *
 * Current provider:
 *   Dash Insight API
 *
 * The base URL can be overridden with:
 *
 *   DASH_TESTNET_INSIGHT_URL
 *
 * Example:
 *   https://insight.testnet.networks.dash.org:3002/insight-api
 */

export interface DashGovernanceProposal {
  proposalHash: string;
  name: string;
  paymentAddress: string;
  paymentAmount: number;
  startEpoch: number;
  endEpoch: number;
  type: number;
  url: string;

  collateralHash?: string;
  creationTime?: number;

  yesCount?: number;
  noCount?: number;
  abstainCount?: number;

  /**
   * Original upstream response.
   * Useful while we are developing/debugging the adapter.
   */
  raw?: unknown;
}

interface InsightGovernanceProposal {
  Hash?: string;
  hash?: string;

  CollateralHash?: string;
  collateralHash?: string;

  CreationTime?: number;
  creationTime?: number;

  DataObject?: {
    name?: string;
    payment_address?: string;
    payment_amount?: number;
    start_epoch?: number;
    end_epoch?: number;
    type?: number;
    url?: string;
  };

  data?: {
    name?: string;
    payment_address?: string;
    payment_amount?: number;
    start_epoch?: number;
    end_epoch?: number;
    type?: number;
    url?: string;
  };

  AbsoluteYesCount?: number;
  YesCount?: number;
  NoCount?: number;
  AbstainCount?: number;
}

const DEFAULT_BASE_URL =
  "https://insight.testnet.networks.dash.org:3002/insight-api";

const REQUEST_TIMEOUT_MS = 10_000;

function getBaseUrl(): string {
  return (
    process.env.DASH_TESTNET_INSIGHT_URL?.replace(/\/+$/, "") ??
    DEFAULT_BASE_URL
  );
}

function assertServerSide(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "Dash Testnet L1 access must run server-side. " +
        "Do not expose the upstream Dash API directly from the browser."
    );
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  assertServerSide();

  const url = `${getBaseUrl()}${path}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Dash Testnet API request failed: ${response.status} ${response.statusText} (${url})`
    );
  }

  return (await response.json()) as T;
}

function normalizeProposal(
  proposal: InsightGovernanceProposal
): DashGovernanceProposal {
  const data = proposal.DataObject ?? proposal.data;

  if (!data) {
    throw new Error("Dash governance response does not contain proposal data");
  }

  const proposalHash = proposal.Hash ?? proposal.hash;

  if (!proposalHash) {
    throw new Error("Dash governance response does not contain proposal hash");
  }

  if (!data.name) {
    throw new Error(`Proposal ${proposalHash} has no name`);
  }

  if (!data.payment_address) {
    throw new Error(`Proposal ${proposalHash} has no payment address`);
  }

  if (data.payment_amount === undefined) {
    throw new Error(`Proposal ${proposalHash} has no payment amount`);
  }

  if (data.start_epoch === undefined) {
    throw new Error(`Proposal ${proposalHash} has no start epoch`);
  }

  if (data.end_epoch === undefined) {
    throw new Error(`Proposal ${proposalHash} has no end epoch`);
  }

  if (!data.url) {
    throw new Error(`Proposal ${proposalHash} has no URL`);
  }

  return {
    proposalHash,

    name: data.name,

    paymentAddress: data.payment_address,

    paymentAmount: data.payment_amount,

    startEpoch: data.start_epoch,

    endEpoch: data.end_epoch,

    type: data.type ?? 1,

    url: data.url,

    collateralHash:
      proposal.CollateralHash ?? proposal.collateralHash,

    creationTime:
      proposal.CreationTime ?? proposal.creationTime,

    yesCount: proposal.YesCount,

    noCount: proposal.NoCount,

    abstainCount: proposal.AbstainCount,

    raw: proposal,
  };
}

/**
 * Fetch all currently available Testnet governance proposals.
 *
 * Upstream endpoint:
 *
 *   /gobject/list/proposal
 */
export async function listTestnetProposals(): Promise<
  DashGovernanceProposal[]
> {
  const response = await fetchJson<
    InsightGovernanceProposal[] | { proposals?: InsightGovernanceProposal[] }
  >("/gobject/list/proposal");

  const proposals = Array.isArray(response)
    ? response
    : response.proposals ?? [];

  return proposals.map(normalizeProposal);
}

/**
 * Fetch one Testnet governance proposal by its
 * Dash Core governance object hash.
 *
 * Upstream endpoint:
 *
 *   /gobject/get/<hash>
 */
export async function getTestnetProposal(
  proposalHash: string
): Promise<DashGovernanceProposal> {
  if (!/^[0-9a-fA-F]{64}$/.test(proposalHash)) {
    throw new Error(`Invalid governance object hash: ${proposalHash}`);
  }

  const response = await fetchJson<InsightGovernanceProposal>(
    `/gobject/get/${encodeURIComponent(proposalHash)}`
  );

  return normalizeProposal(response);
}

/**
 * Convenience method for checking whether the
 * Testnet L1 provider is reachable.
 */
export async function checkDashTestnet(): Promise<boolean> {
  try {
    await fetchJson<unknown>("/gobject/list/proposal");
    return true;
  } catch {
    return false;
  }
}