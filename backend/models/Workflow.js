const mongoose = require('mongoose');

// Schema for node position
const positionSchema = new mongoose.Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
}, { _id: false });

// Schema for input parameters
const inputParameterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  description: String,
}, { _id: false });

// Schema for configured input values
const inputValueSchema = new mongoose.Schema({
  value: String,
  source: { type: String, enum: ['manual', 'connection'], default: 'manual' },
}, { _id: false });

// Schema for output
const outputSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  description: String,
}, { _id: false });

// Schema for workflow nodes (triggers and agents)
const nodeSchema = new mongoose.Schema({
  // React Flow node ID
  id: { type: String, required: true },
  // Node type: 'trigger' or 'agent'
  type: { type: String, required: true, enum: ['trigger', 'agent'] },
  // Position on canvas
  position: { type: positionSchema, required: true },
  // Node data
  data: {
    label: { type: String, required: true },
    // For triggers
    triggerType: String, // 'manual', 'price_gte', 'price_lte'
    triggerConfig: mongoose.Schema.Types.Mixed, // Trigger-specific config (e.g., target price)
    // For agents
    agentId: String, // Agent identifier from the agents service
    agentType: String, // 'swap', 'transfer', 'custom', etc.
    status: { type: String, enum: ['active', 'inactive', 'configuring'], default: 'configuring' },
    description: String,
    invokeUrl: String, // API endpoint to invoke this agent
    executionCost: String, // Cost to run this agent (e.g., "1 ADA")
    inputParameters: [inputParameterSchema],
    output: outputSchema,
    // User-configured input values
    inputValues: { type: Map, of: inputValueSchema },
  },
}, { _id: false });

// Schema for edges (connections between nodes)
const edgeSchema = new mongoose.Schema({
  // React Flow edge ID
  id: { type: String, required: true },
  // Source node ID
  source: { type: String, required: true },
  // Source handle ID (e.g., 'trigger-out', 'output-amount')
  sourceHandle: String,
  // Target node ID
  target: { type: String, required: true },
  // Target handle ID (e.g., 'trigger-in', 'input-amount')
  targetHandle: String,
  // Edge type for styling
  type: String,
  // Whether edge is animated
  animated: Boolean,
}, { _id: false });

// Main workflow schema
const workflowSchema = new mongoose.Schema({
  // Reference to user
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // Workflow name
  name: {
    type: String,
    required: true,
    trim: true,
  },
  // Workflow description
  description: {
    type: String,
    trim: true,
  },
  // Active/inactive status
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'inactive',
  },
  // All nodes in the workflow
  nodes: [nodeSchema],
  // All edges (connections) in the workflow
  edges: [edgeSchema],
  // Viewport state for restoring canvas position/zoom
  viewport: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    zoom: { type: Number, default: 1 },
  },
  // Execution statistics
  stats: {
    totalExecutions: { type: Number, default: 0 },
    successfulExecutions: { type: Number, default: 0 },
    failedExecutions: { type: Number, default: 0 },
    lastExecutedAt: Date,
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
workflowSchema.pre('save', function() {
  this.updatedAt = new Date();
});

// Index for efficient queries
workflowSchema.index({ userId: 1, status: 1 });
workflowSchema.index({ userId: 1, createdAt: -1 });

// Virtual for basic info (used in list responses)
workflowSchema.virtual('basicInfo').get(function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    status: this.status,
    nodeCount: this.nodes?.length || 0,
    edgeCount: this.edges?.length || 0,
    stats: this.stats,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
});

// Ensure virtuals are included
workflowSchema.set('toJSON', { virtuals: true });
workflowSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Workflow', workflowSchema);
