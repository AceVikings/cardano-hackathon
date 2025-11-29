import { auth } from '../config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// ============================================================================
// API Request Helper with Firebase Auth
// ============================================================================

/**
 * Get the current Firebase user's ID token
 */
async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    // Force refresh ensures we always have a valid token
    return await user.getIdToken(true);
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
}

/**
 * Make an authenticated API request with Firebase token
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Firebase auth token if user is authenticated
  const idToken = await getIdToken();
  if (idToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  return response.json();
}

// ============================================================================
// Custodial Wallet API
// ============================================================================

export interface CustodialWalletStatus {
  initialized: boolean;
  scriptAddress: string;
  ownerPkh: string | null;
  approvedAgents: Array<{
    pkh: string;
    name: string;
    addedAt: string;
  }>;
  lastKnownBalance: {
    lovelace: string;
    tokens: Array<{ unit: string; quantity: string }>;
  };
  lastBalanceCheck: string | null;
}

/**
 * Get custodial wallet status
 */
export async function getWalletStatus(): Promise<CustodialWalletStatus> {
  const response = await apiRequest<{ success: boolean; wallet: CustodialWalletStatus }>('/wallet/status');
  return response.wallet;
}

/**
 * Initialize custodial wallet
 */
export async function initializeWallet(ownerPkh: string): Promise<CustodialWalletStatus> {
  const response = await apiRequest<{ success: boolean; wallet: CustodialWalletStatus }>('/wallet/initialize', {
    method: 'POST',
    body: JSON.stringify({ ownerPkh }),
  });
  return response.wallet;
}

/**
 * Add an approved agent
 */
export async function addAgent(agentPkh: string, agentName: string): Promise<Array<{ pkh: string; name: string; addedAt: string }>> {
  const response = await apiRequest<{ success: boolean; approvedAgents: Array<{ pkh: string; name: string; addedAt: string }> }>('/wallet/add-agent', {
    method: 'POST',
    body: JSON.stringify({ agentPkh, agentName }),
  });
  return response.approvedAgents;
}

/**
 * Remove an approved agent
 */
export async function removeAgent(agentPkh: string): Promise<Array<{ pkh: string; name: string; addedAt: string }>> {
  const response = await apiRequest<{ success: boolean; approvedAgents: Array<{ pkh: string; name: string; addedAt: string }> }>(`/wallet/remove-agent/${agentPkh}`, {
    method: 'DELETE',
  });
  return response.approvedAgents;
}

/**
 * Update cached balance
 */
export async function updateWalletBalance(lovelace: string, tokens: Array<{ unit: string; quantity: string }>): Promise<void> {
  await apiRequest('/wallet/update-balance', {
    method: 'POST',
    body: JSON.stringify({ lovelace, tokens }),
  });
}

// ============================================================================
// Available Agents API
// ============================================================================

export interface AgentInputParameter {
  name: string;
  type: string;
  description: string;
}

export interface AgentOutput {
  name: string;
  type: string;
  description: string;
}

export interface AvailableAgent {
  name: string;
  description: string;
  inputParameters: AgentInputParameter[];
  output: AgentOutput;
}

export interface AvailableAgentsResponse {
  agents: AvailableAgent[];
}

/**
 * Get available agents from the API
 */
export async function getAvailableAgents(): Promise<AvailableAgent[]> {
  const response = await apiRequest<AvailableAgentsResponse>('/available-agents');
  return response.agents;
}

export { apiRequest };
