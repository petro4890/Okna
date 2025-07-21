const express = require('express');
const { body, validationResult } = require('express-validator');
const { Order, Client, User } = require('../models');
const { authenticateToken, requireManagement } = require('../middleware/auth');

const router = express.Router();

// Mock CRM API integration
// In a real implementation, this would connect to your actual CRM system

// Simulate CRM API call
async function callCRMAPI(endpoint, method = 'GET', data = null) {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock CRM responses based on endpoint
    switch (endpoint) {
      case '/customers':
        return {
          success: true,
          data: [
            {
              id: 'crm_001',
              name: 'John Smith',
              email: 'john.smith@email.com',
              phone: '+1-555-0101',
              address: '123 Main St, Anytown, ST 12345',
              status: 'active',
              created_date: '2024-01-15',
              total_orders: 3,
              total_value: 15000
            },
            {
              id: 'crm_002',
              name: 'ABC Construction LLC',
              email: 'contact@abcconstruction.com',
              phone: '+1-555-0102',
              address: '456 Business Ave, Commerce City, ST 12346',
              status: 'active',
              created_date: '2024-02-01',
              total_orders: 8,
              total_value: 45000
            }
          ]
        };

      case '/orders':
        return {
          success: true,
          data: [
            {
              id: 'crm_order_001',
              customer_id: 'crm_001',
              order_number: 'CRM-2024-001',
              status: 'in_production',
              total_amount: 5000,
              order_date: '2024-07-01',
              estimated_completion: '2024-08-15',
              items: [
                {
                  product: 'Double Hung Window',
                  quantity: 4,
                  unit_price: 1250
                }
              ]
            },
            {
              id: 'crm_order_002',
              customer_id: 'crm_002',
              order_number: 'CRM-2024-002',
              status: 'measuring_scheduled',
              total_amount: 12000,
              order_date: '2024-07-10',
              estimated_completion: '2024-09-01',
              items: [
                {
                  product: 'Commercial Window System',
                  quantity: 20,
                  unit_price: 600
                }
              ]
            }
          ]
        };

      case '/sync':
        return {
          success: true,
          message: 'Data synchronized successfully',
          synced_customers: 2,
          synced_orders: 2,
          timestamp: new Date().toISOString()
        };

      default:
        return {
          success: false,
          error: 'Endpoint not found'
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Get CRM customers
router.get('/customers', authenticateToken, requireManagement, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    // Call CRM API
    const crmResponse = await callCRMAPI('/customers');

    if (!crmResponse.success) {
      return res.status(500).json({ error: 'Failed to fetch CRM customers' });
    }

    let customers = crmResponse.data;

    // Apply filters
    if (status) {
      customers = customers.filter(c => c.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      customers = customers.filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        c.email.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedCustomers = customers.slice(startIndex, endIndex);

    res.json({
      customers: paginatedCustomers,
      pagination: {
        total: customers.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(customers.length / limit)
      }
    });

  } catch (error) {
    console.error('Get CRM customers error:', error);
    res.status(500).json({ error: 'Failed to fetch CRM customers' });
  }
});

// Get CRM orders
router.get('/orders', authenticateToken, requireManagement, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, customer_id } = req.query;

    // Call CRM API
    const crmResponse = await callCRMAPI('/orders');

    if (!crmResponse.success) {
      return res.status(500).json({ error: 'Failed to fetch CRM orders' });
    }

    let orders = crmResponse.data;

    // Apply filters
    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    if (customer_id) {
      orders = orders.filter(o => o.customer_id === customer_id);
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedOrders = orders.slice(startIndex, endIndex);

    res.json({
      orders: paginatedOrders,
      pagination: {
        total: orders.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(orders.length / limit)
      }
    });

  } catch (error) {
    console.error('Get CRM orders error:', error);
    res.status(500).json({ error: 'Failed to fetch CRM orders' });
  }
});

// Sync data from CRM
router.post('/sync', authenticateToken, requireManagement, async (req, res) => {
  try {
    // Call CRM sync endpoint
    const crmResponse = await callCRMAPI('/sync', 'POST');

    if (!crmResponse.success) {
      return res.status(500).json({ error: 'CRM sync failed' });
    }

    // In a real implementation, you would:
    // 1. Fetch updated data from CRM
    // 2. Update local database records
    // 3. Create new records for new CRM entries
    // 4. Handle conflicts and data mapping

    // Mock sync process
    const syncResults = {
      customers_synced: crmResponse.synced_customers || 0,
      orders_synced: crmResponse.synced_orders || 0,
      sync_timestamp: crmResponse.timestamp,
      status: 'completed'
    };

    res.json({
      message: 'CRM sync completed successfully',
      results: syncResults
    });

  } catch (error) {
    console.error('CRM sync error:', error);
    res.status(500).json({ error: 'CRM sync failed' });
  }
});

// Get CRM customer by ID
router.get('/customers/:customerId', authenticateToken, requireManagement, async (req, res) => {
  try {
    const { customerId } = req.params;

    // Call CRM API to get specific customer
    const crmResponse = await callCRMAPI('/customers');

    if (!crmResponse.success) {
      return res.status(500).json({ error: 'Failed to fetch CRM customer' });
    }

    const customer = crmResponse.data.find(c => c.id === customerId);

    if (!customer) {
      return res.status(404).json({ error: 'CRM customer not found' });
    }

    // Get related orders
    const ordersResponse = await callCRMAPI('/orders');
    const customerOrders = ordersResponse.success 
      ? ordersResponse.data.filter(o => o.customer_id === customerId)
      : [];

    res.json({
      customer: {
        ...customer,
        orders: customerOrders
      }
    });

  } catch (error) {
    console.error('Get CRM customer error:', error);
    res.status(500).json({ error: 'Failed to fetch CRM customer' });
  }
});

// Update order status in CRM
router.put('/orders/:crmOrderId/status', authenticateToken, requireManagement, [
  body('status').notEmpty().withMessage('Status is required'),
  body('notes').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { crmOrderId } = req.params;
    const { status, notes } = req.body;

    // In a real implementation, this would make an API call to update the CRM
    // For now, simulate the update
    const updateResponse = {
      success: true,
      message: 'Order status updated in CRM',
      order_id: crmOrderId,
      new_status: status,
      updated_at: new Date().toISOString()
    };

    res.json({
      message: 'CRM order status updated successfully',
      crm_response: updateResponse
    });

  } catch (error) {
    console.error('Update CRM order status error:', error);
    res.status(500).json({ error: 'Failed to update CRM order status' });
  }
});

// Import CRM customer to local system
router.post('/customers/:customerId/import', authenticateToken, requireManagement, async (req, res) => {
  try {
    const { customerId } = req.params;

    // Get customer from CRM
    const crmResponse = await callCRMAPI('/customers');
    if (!crmResponse.success) {
      return res.status(500).json({ error: 'Failed to fetch CRM customer' });
    }

    const crmCustomer = crmResponse.data.find(c => c.id === customerId);
    if (!crmCustomer) {
      return res.status(404).json({ error: 'CRM customer not found' });
    }

    // Check if customer already exists locally
    const existingClient = await Client.findOne({
      where: { crm_customer_id: customerId }
    });

    if (existingClient) {
      return res.status(409).json({ error: 'Customer already imported' });
    }

    // Create user account
    const user = await User.create({
      email: crmCustomer.email,
      first_name: crmCustomer.name.split(' ')[0],
      last_name: crmCustomer.name.split(' ').slice(1).join(' ') || 'Customer',
      phone_number: crmCustomer.phone,
      password_hash: 'temp_password_hash', // Would generate proper password
      role: 'client'
    });

    // Create client profile
    const client = await Client.create({
      user_id: user.id,
      client_type: crmCustomer.name.includes('LLC') || crmCustomer.name.includes('Inc') ? 'legal_entity' : 'individual',
      company_name: crmCustomer.name.includes('LLC') || crmCustomer.name.includes('Inc') ? crmCustomer.name : null,
      address: crmCustomer.address.split(',')[0],
      city: crmCustomer.address.split(',')[1]?.trim() || 'Unknown',
      state: crmCustomer.address.split(',')[2]?.trim()?.split(' ')[0] || 'Unknown',
      postal_code: crmCustomer.address.split(',')[2]?.trim()?.split(' ')[1] || '00000',
      crm_customer_id: customerId
    });

    res.status(201).json({
      message: 'Customer imported successfully',
      user: user.toSafeJSON(),
      client
    });

  } catch (error) {
    console.error('Import CRM customer error:', error);
    res.status(500).json({ error: 'Failed to import CRM customer' });
  }
});

// Get CRM integration status
router.get('/status', authenticateToken, requireManagement, async (req, res) => {
  try {
    // Check CRM connectivity
    const healthCheck = await callCRMAPI('/health');
    
    const status = {
      connected: healthCheck.success,
      last_sync: '2024-07-21T09:43:04Z', // Mock timestamp
      api_version: '2.1',
      endpoints_available: [
        '/customers',
        '/orders',
        '/sync',
        '/health'
      ],
      sync_frequency: 'Every 4 hours',
      next_sync: '2024-07-21T13:43:04Z'
    };

    res.json({ status });

  } catch (error) {
    console.error('Get CRM status error:', error);
    res.status(500).json({ error: 'Failed to get CRM status' });
  }
});

// Get CRM sync history
router.get('/sync/history', authenticateToken, requireManagement, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Mock sync history
    const syncHistory = [
      {
        id: 'sync_001',
        timestamp: '2024-07-21T05:43:04Z',
        status: 'completed',
        customers_synced: 15,
        orders_synced: 23,
        duration: '2.3s',
        errors: 0
      },
      {
        id: 'sync_002',
        timestamp: '2024-07-21T01:43:04Z',
        status: 'completed',
        customers_synced: 12,
        orders_synced: 18,
        duration: '1.8s',
        errors: 0
      },
      {
        id: 'sync_003',
        timestamp: '2024-07-20T21:43:04Z',
        status: 'failed',
        customers_synced: 0,
        orders_synced: 0,
        duration: '0.5s',
        errors: 1,
        error_message: 'CRM API timeout'
      }
    ];

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedHistory = syncHistory.slice(startIndex, endIndex);

    res.json({
      sync_history: paginatedHistory,
      pagination: {
        total: syncHistory.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(syncHistory.length / limit)
      }
    });

  } catch (error) {
    console.error('Get CRM sync history error:', error);
    res.status(500).json({ error: 'Failed to fetch CRM sync history' });
  }
});

// Configure CRM settings
router.put('/settings', authenticateToken, requireManagement, [
  body('api_url').optional().isURL(),
  body('api_key').optional().isLength({ min: 10 }),
  body('sync_frequency').optional().isIn(['hourly', 'every_4_hours', 'daily', 'manual']),
  body('auto_sync_enabled').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const settings = req.body;

    // In a real implementation, this would save settings to database
    // For now, return mock success
    res.json({
      message: 'CRM settings updated successfully',
      settings: {
        api_url: settings.api_url || process.env.CRM_API_URL,
        sync_frequency: settings.sync_frequency || 'every_4_hours',
        auto_sync_enabled: settings.auto_sync_enabled !== undefined ? settings.auto_sync_enabled : true,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update CRM settings error:', error);
    res.status(500).json({ error: 'Failed to update CRM settings' });
  }
});

module.exports = router;