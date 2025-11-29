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
// Developer Wallet API
// ============================================================================

export interface DeveloperWallet {
  walletId: string;
  paymentAddress: string;
  stakeAddress: string | null;
  createdAt: string;
}

export interface WalletBalance {
  lovelace: string;
  ada: number;
  tokens: Array<{ unit: string; quantity: string }>;
  utxoCount: number;
}

/**
 * Get or create user's developer-controlled wallet
 */
export async function getDeveloperWallet(): Promise<DeveloperWallet> {
  const response = await apiRequest<{ success: boolean; wallet: DeveloperWallet; message?: string }>('/wallet');
  return response.wallet;
}

/**
 * Get the ADA balance of the user's developer wallet
 */
export async function getWalletBalance(): Promise<WalletBalance> {
  const response = await apiRequest<{ success: boolean; balance: WalletBalance }>('/wallet/balance');
  return response.balance;
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
  id: string;
  name: string;
  description: string;
  invokeUrl: string;
  executionCost: string;
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

// ============================================================================
// Available Triggers API
// ============================================================================

export interface TriggerConfigPreset {
  label: string;
  value: string;
}

export interface TriggerConfigField {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: string | number;
  presets?: TriggerConfigPreset[];
}

export interface AvailableTrigger {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  configSchema: TriggerConfigField[];
}

export interface AvailableTriggersResponse {
  triggers: AvailableTrigger[];
}

/**
 * Get available triggers from the API
 */
export async function getAvailableTriggers(): Promise<AvailableTrigger[]> {
  const response = await apiRequest<AvailableTriggersResponse>('/available-triggers');
  return response.triggers;
}

// ============================================================================
// Workflow API
// ============================================================================

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'agent';
  position: { x: number; y: number };
  data: {
    label: string;
    // Trigger-specific fields
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    // Agent-specific fields
    agentId?: string;
    agentType?: string;
    status?: 'active' | 'inactive' | 'configuring';
    description?: string;
    invokeUrl?: string;
    executionCost?: string;
    inputParameters?: Array<{ name: string; type: string; description: string }>;
    output?: { name: string; type: string; description: string };
    // User-configured input values
    inputValues?: Record<string, { value: string; source: 'manual' | 'connection' }>;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
}

export interface WorkflowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkflowStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecutedAt?: string;
}

export interface WorkflowBasicInfo {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  nodeCount: number;
  edgeCount: number;
  stats: WorkflowStats;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowFull extends Omit<WorkflowBasicInfo, 'nodeCount' | 'edgeCount'> {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: WorkflowViewport;
}

export interface CreateWorkflowData {
  name: string;
  description?: string;
  status?: 'active' | 'inactive';
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: WorkflowViewport;
}

export interface UpdateWorkflowData {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive';
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  viewport?: WorkflowViewport;
}

/**
 * Get all workflows for current user (basic info only)
 */
export async function getWorkflows(status?: 'active' | 'inactive'): Promise<WorkflowBasicInfo[]> {
  const queryParam = status ? `?status=${status}` : '';
  const response = await apiRequest<{ success: boolean; workflows: WorkflowBasicInfo[]; count: number }>(
    `/workflows${queryParam}`
  );
  return response.workflows;
}

/**
 * Get single workflow by ID (full data)
 */
export async function getWorkflowById(id: string): Promise<WorkflowFull> {
  const response = await apiRequest<{ success: boolean; workflow: WorkflowFull }>(
    `/workflows/${id}`
  );
  return response.workflow;
}

/**
 * Create new workflow
 */
export async function createWorkflow(data: CreateWorkflowData): Promise<WorkflowFull> {
  const response = await apiRequest<{ success: boolean; workflow: WorkflowFull }>(
    '/workflows',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
  return response.workflow;
}

/**
 * Update workflow
 */
export async function updateWorkflow(id: string, data: UpdateWorkflowData): Promise<WorkflowFull> {
  const response = await apiRequest<{ success: boolean; workflow: WorkflowFull }>(
    `/workflows/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );
  return response.workflow;
}

/**
 * Toggle workflow status
 */
export async function updateWorkflowStatus(id: string, status: 'active' | 'inactive'): Promise<WorkflowBasicInfo> {
  const response = await apiRequest<{ success: boolean; workflow: WorkflowBasicInfo }>(
    `/workflows/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
  return response.workflow;
}

/**
 * Delete workflow
 */
export async function deleteWorkflow(id: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/workflows/${id}`,
    {
      method: 'DELETE',
    }
  );
}

// ============================================================================
// Workflow Execution API
// ============================================================================

export interface ExecutionNodeResult {
  nodeId: string;
  nodeType: 'trigger' | 'agent';
  label: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  startTime: string;
  endTime?: string;
  duration?: number;
  output?: Record<string, unknown>;
  error?: string;
}

export interface ExecutionResult {
  executionId: string;
  workflowId: string;
  workflowName: string;
  triggerType: string;
  triggerData?: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  nodeResults: ExecutionNodeResult[];
  summary: {
    totalNodes: number;
    successfulNodes: number;
    failedNodes: number;
  };
  timing: {
    startTime: string;
    endTime: string;
    duration: number;
  };
}

export interface WorkflowValidation {
  valid: boolean;
  error?: string;
  workflow?: {
    id: string;
    name: string;
    status: 'active' | 'inactive';
    nodeCount: number;
    agentCount: number;
    triggerType?: string;
  };
}

/**
 * Execute a workflow manually
 */
export async function executeWorkflow(
  id: string, 
  triggerData?: Record<string, unknown>
): Promise<ExecutionResult> {
  const response = await apiRequest<{ success: boolean; execution: ExecutionResult }>(
    `/workflows/${id}/execute`,
    {
      method: 'POST',
      body: JSON.stringify({ triggerData }),
    }
  );
  return response.execution;
}

/**
 * Validate a workflow without executing it
 */
export async function validateWorkflow(id: string): Promise<WorkflowValidation> {
  const response = await apiRequest<{ success: boolean; valid: boolean; error?: string; workflow?: WorkflowValidation['workflow'] }>(
    `/workflows/${id}/validate`,
    {
      method: 'POST',
    }
  );
  return {
    valid: response.valid,
    error: response.error,
    workflow: response.workflow,
  };
}

export { apiRequest };
