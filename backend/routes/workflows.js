const express = require('express');
const router = express.Router();
const Workflow = require('../models/Workflow');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// ============================================================================
// GET /api/workflows - Get all workflows for current user (basic info only)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    
    // Build query
    const query = { userId: req.user._id };
    if (status && ['active', 'inactive'].includes(status)) {
      query.status = status;
    }

    // Fetch workflows with only basic fields (no nodes/edges)
    const workflows = await Workflow.find(query)
      .select('name description status stats createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    // Add node/edge counts from a separate aggregation for efficiency
    const workflowIds = workflows.map(w => w._id);
    const counts = await Workflow.aggregate([
      { $match: { _id: { $in: workflowIds } } },
      {
        $project: {
          _id: 1,
          nodeCount: { $size: { $ifNull: ['$nodes', []] } },
          edgeCount: { $size: { $ifNull: ['$edges', []] } },
        },
      },
    ]);

    // Create a map for quick lookup
    const countMap = new Map(counts.map(c => [c._id.toString(), c]));

    // Combine data
    const result = workflows.map(w => ({
      id: w._id,
      name: w.name,
      description: w.description,
      status: w.status,
      nodeCount: countMap.get(w._id.toString())?.nodeCount || 0,
      edgeCount: countMap.get(w._id.toString())?.edgeCount || 0,
      stats: w.stats,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    res.json({
      success: true,
      workflows: result,
      count: result.length,
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflows',
    });
  }
});

// ============================================================================
// GET /api/workflows/:id - Get single workflow by ID (full data)
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await Workflow.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    res.json({
      success: true,
      workflow: {
        id: workflow._id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        nodes: workflow.nodes,
        edges: workflow.edges,
        viewport: workflow.viewport,
        stats: workflow.stats,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow ID',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflow',
    });
  }
});

// ============================================================================
// POST /api/workflows - Create new workflow
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { name, description, nodes, edges, viewport, status } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Workflow name is required',
      });
    }

    // Create workflow
    const workflow = new Workflow({
      userId: req.user._id,
      name: name.trim(),
      description: description?.trim() || '',
      status: status === 'active' ? 'active' : 'inactive',
      nodes: nodes || [],
      edges: edges || [],
      viewport: viewport || { x: 0, y: 0, zoom: 1 },
    });

    await workflow.save();

    res.status(201).json({
      success: true,
      workflow: {
        id: workflow._id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        nodes: workflow.nodes,
        edges: workflow.edges,
        viewport: workflow.viewport,
        stats: workflow.stats,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow data',
        details: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create workflow',
    });
  }
});

// ============================================================================
// PUT /api/workflows/:id - Update workflow
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, nodes, edges, viewport, status } = req.body;

    // Find workflow
    const workflow = await Workflow.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Update fields if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Workflow name cannot be empty',
        });
      }
      workflow.name = name.trim();
    }

    if (description !== undefined) {
      workflow.description = description?.trim() || '';
    }

    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Status must be "active" or "inactive"',
        });
      }
      workflow.status = status;
    }

    if (nodes !== undefined) {
      workflow.nodes = nodes;
    }

    if (edges !== undefined) {
      workflow.edges = edges;
    }

    if (viewport !== undefined) {
      workflow.viewport = viewport;
    }

    await workflow.save();

    res.json({
      success: true,
      workflow: {
        id: workflow._id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        nodes: workflow.nodes,
        edges: workflow.edges,
        viewport: workflow.viewport,
        stats: workflow.stats,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow ID',
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow data',
        details: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update workflow',
    });
  }
});

// ============================================================================
// PATCH /api/workflows/:id/status - Toggle workflow status
// ============================================================================
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be "active" or "inactive"',
      });
    }

    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { status, updatedAt: new Date() },
      { new: true }
    ).select('name description status stats createdAt updatedAt');

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    res.json({
      success: true,
      workflow: {
        id: workflow._id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        stats: workflow.stats,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating workflow status:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow ID',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update workflow status',
    });
  }
});

// ============================================================================
// DELETE /api/workflows/:id - Delete workflow
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await Workflow.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    res.json({
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow ID',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete workflow',
    });
  }
});

module.exports = router;
