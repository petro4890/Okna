const express = require('express');
const { body, validationResult } = require('express-validator');
const { Contract, Order, Client, User } = require('../models');
const { 
  authenticateToken, 
  requireAdmin, 
  requireManagement,
  logUserAction 
} = require('../middleware/auth');
const { sendContractEmail } = require('../utils/notifications');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Get all contracts (Management only)
router.get('/', authenticateToken, requireManagement, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      contract_type, 
      is_signed,
      order_id,
      search
    } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (contract_type) whereClause.contract_type = contract_type;
    if (is_signed !== undefined) whereClause.is_signed = is_signed === 'true';
    if (order_id) whereClause.order_id = order_id;

    const include = [
      {
        model: Order,
        as: 'order',
        include: [{
          model: Client,
          as: 'client',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'email']
          }]
        }]
      }
    ];

    // Add search functionality
    if (search) {
      whereClause[require('sequelize').Op.or] = [
        { contract_number: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { '$order.order_number$': { [require('sequelize').Op.iLike]: `%${search}%` } },
        { '$order.client.user.first_name$': { [require('sequelize').Op.iLike]: `%${search}%` } },
        { '$order.client.user.last_name$': { [require('sequelize').Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: contracts } = await Contract.findAndCountAll({
      where: whereClause,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      distinct: true
    });

    res.json({
      contracts,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// Get contract by ID
router.get('/:contractId', authenticateToken, async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findByPk(contractId, {
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            {
              model: Client,
              as: 'client',
              include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
              }]
            },
            {
              model: User,
              as: 'assignedManager',
              attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
            }
          ]
        }
      ]
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check permissions
    const isClient = req.user.role === 'client';
    const isClientOwner = isClient && contract.order.client.user_id === req.user.id;
    const canViewAllContracts = req.user.canViewAllProjects();

    if (!canViewAllContracts && !isClientOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ contract });

  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({ error: 'Failed to fetch contract' });
  }
});

// Create new contract (Admin only)
router.post('/', authenticateToken, requireAdmin, logUserAction('create_contract'), [
  body('order_id').isUUID().withMessage('Valid order ID is required'),
  body('contract_type').isIn(['service_agreement', 'installation_contract', 'warranty', 'amendment']).withMessage('Valid contract type is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { order_id, contract_type } = req.body;

    // Verify order exists
    const order = await Order.findByPk(order_id, {
      include: [{
        model: Client,
        as: 'client',
        include: [{
          model: User,
          as: 'user'
        }]
      }]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Create contract
    const contract = await Contract.create({
      order_id,
      contract_type
    });

    // Generate PDF contract
    const pdfPath = await generateContractPDF(contract, order);
    await contract.update({ 
      file_path: pdfPath,
      file_url: `/uploads/contracts/${contract.getFileName()}`
    });

    res.status(201).json({
      message: 'Contract created successfully',
      contract
    });

  } catch (error) {
    console.error('Create contract error:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// Generate contract PDF
async function generateContractPDF(contract, order) {
  try {
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../uploads/contracts');
    await fs.mkdir(uploadsDir, { recursive: true });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Generate HTML content for the contract
    const htmlContent = generateContractHTML(contract, order);

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfPath = path.join(uploadsDir, `${contract.contract_number}.pdf`);
    
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    await browser.close();

    return pdfPath;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Failed to generate contract PDF');
  }
}

// Generate HTML content for contract
function generateContractHTML(contract, order) {
  const client = order.client;
  const clientUser = client.user;
  const currentDate = new Date().toLocaleDateString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contract ${contract.contract_number}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #1C77FF;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #1C77FF;
            margin-bottom: 10px;
        }
        .contract-title {
            font-size: 24px;
            color: #333;
            margin-bottom: 5px;
        }
        .contract-number {
            font-size: 16px;
            color: #666;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #1C77FF;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .info-item {
            margin-bottom: 10px;
        }
        .label {
            font-weight: bold;
            color: #555;
        }
        .value {
            color: #333;
        }
        .terms {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #27AE60;
        }
        .signature-section {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }
        .signature-box {
            border-top: 2px solid #333;
            padding-top: 10px;
            text-align: center;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #eee;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">${process.env.COMPANY_NAME || 'Window Manufacturing Company'}</div>
        <div class="contract-title">${contract.getContractTypeDisplay()}</div>
        <div class="contract-number">Contract #${contract.contract_number}</div>
    </div>

    <div class="section">
        <div class="section-title">Contract Information</div>
        <div class="info-grid">
            <div>
                <div class="info-item">
                    <span class="label">Contract Date:</span>
                    <span class="value">${currentDate}</span>
                </div>
                <div class="info-item">
                    <span class="label">Order Number:</span>
                    <span class="value">${order.order_number}</span>
                </div>
                <div class="info-item">
                    <span class="label">Contract Type:</span>
                    <span class="value">${contract.getContractTypeDisplay()}</span>
                </div>
            </div>
            <div>
                <div class="info-item">
                    <span class="label">Total Amount:</span>
                    <span class="value">$${order.total_amount || 'TBD'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Estimated Completion:</span>
                    <span class="value">${order.estimated_completion_date || 'TBD'}</span>
                </div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Client Information</div>
        <div class="info-grid">
            <div>
                <div class="info-item">
                    <span class="label">Name:</span>
                    <span class="value">${clientUser.first_name} ${clientUser.last_name}</span>
                </div>
                <div class="info-item">
                    <span class="label">Email:</span>
                    <span class="value">${clientUser.email || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Phone:</span>
                    <span class="value">${clientUser.phone_number || 'N/A'}</span>
                </div>
            </div>
            <div>
                <div class="info-item">
                    <span class="label">Client Type:</span>
                    <span class="value">${client.client_type === 'legal_entity' ? 'Legal Entity' : 'Individual'}</span>
                </div>
                ${client.company_name ? `
                <div class="info-item">
                    <span class="label">Company:</span>
                    <span class="value">${client.company_name}</span>
                </div>
                ` : ''}
                <div class="info-item">
                    <span class="label">Address:</span>
                    <span class="value">${client.getFullAddress()}</span>
                </div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Terms and Conditions</div>
        <div class="terms">
            <p><strong>1. Scope of Work:</strong> This contract covers the ${contract.getContractTypeDisplay().toLowerCase()} for order ${order.order_number}.</p>
            
            <p><strong>2. Payment Terms:</strong> Payment is due according to the agreed schedule. A deposit may be required before work begins.</p>
            
            <p><strong>3. Timeline:</strong> Work will be completed according to the estimated timeline provided. Delays due to weather or unforeseen circumstances may extend the completion date.</p>
            
            <p><strong>4. Warranty:</strong> All work is guaranteed for a period of one year from completion date, covering defects in materials and workmanship.</p>
            
            <p><strong>5. Changes:</strong> Any changes to the original scope of work must be agreed upon in writing and may affect the total cost and timeline.</p>
            
            <p><strong>6. Cancellation:</strong> This contract may be cancelled by either party with written notice, subject to payment for work already completed.</p>
        </div>
    </div>

    <div class="signature-section">
        <div class="signature-box">
            <div class="label">Client Signature</div>
            <div style="margin-top: 20px;">Date: _______________</div>
        </div>
        <div class="signature-box">
            <div class="label">Company Representative</div>
            <div style="margin-top: 20px;">Date: _______________</div>
        </div>
    </div>

    <div class="footer">
        <p>${process.env.COMPANY_NAME || 'Window Manufacturing Company'}</p>
        <p>${process.env.COMPANY_ADDRESS || '123 Manufacturing St, Industrial District, City, State 12345'}</p>
        <p>Phone: ${process.env.COMPANY_PHONE || '+1-555-0123'} | Email: ${process.env.COMPANY_EMAIL || 'info@windowcompany.com'}</p>
    </div>
</body>
</html>
  `;
}

// Download contract PDF
router.get('/:contractId/download', authenticateToken, async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findByPk(contractId, {
      include: [{
        model: Order,
        as: 'order',
        include: [{
          model: Client,
          as: 'client',
          include: [{
            model: User,
            as: 'user'
          }]
        }]
      }]
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check permissions
    const isClient = req.user.role === 'client';
    const isClientOwner = isClient && contract.order.client.user_id === req.user.id;
    const canViewAllContracts = req.user.canViewAllProjects();

    if (!canViewAllContracts && !isClientOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!contract.hasFile()) {
      return res.status(404).json({ error: 'Contract file not found' });
    }

    const filePath = contract.file_path;
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Contract file not found on server' });
    }

    res.download(filePath, contract.getFileName());

  } catch (error) {
    console.error('Download contract error:', error);
    res.status(500).json({ error: 'Failed to download contract' });
  }
});

// Send contract via email
router.post('/:contractId/send-email', authenticateToken, requireManagement, [
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { contractId } = req.params;
    const { email } = req.body;

    const contract = await Contract.findByPk(contractId, {
      include: [{
        model: Order,
        as: 'order',
        include: [{
          model: Client,
          as: 'client',
          include: [{
            model: User,
            as: 'user'
          }]
        }]
      }]
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (!contract.hasFile()) {
      return res.status(400).json({ error: 'Contract file not available' });
    }

    const clientUser = contract.order.client.user;
    const recipientEmail = email || clientUser.email;

    if (!recipientEmail) {
      return res.status(400).json({ error: 'No email address available' });
    }

    const contractData = {
      contract_number: contract.contract_number,
      contract_type: contract.getContractTypeDisplay(),
      order_number: contract.order.order_number,
      client_name: clientUser.getFullName()
    };

    const result = await sendContractEmail(recipientEmail, contractData, contract.file_path);

    if (result.success) {
      res.json({ message: 'Contract sent successfully via email' });
    } else {
      res.status(500).json({ error: 'Failed to send contract email' });
    }

  } catch (error) {
    console.error('Send contract email error:', error);
    res.status(500).json({ error: 'Failed to send contract email' });
  }
});

// Mark contract as signed
router.put('/:contractId/sign', authenticateToken, async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findByPk(contractId, {
      include: [{
        model: Order,
        as: 'order',
        include: [{
          model: Client,
          as: 'client',
          include: [{
            model: User,
            as: 'user'
          }]
        }]
      }]
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check permissions - only client owner or management can sign
    const isClient = req.user.role === 'client';
    const isClientOwner = isClient && contract.order.client.user_id === req.user.id;
    const canManageContracts = req.user.canViewAllProjects();

    if (!canManageContracts && !isClientOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (contract.is_signed) {
      return res.status(400).json({ error: 'Contract is already signed' });
    }

    contract.markAsSigned();
    await contract.save();

    res.json({
      message: 'Contract signed successfully',
      contract
    });

  } catch (error) {
    console.error('Sign contract error:', error);
    res.status(500).json({ error: 'Failed to sign contract' });
  }
});

// Get contracts for specific order
router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Verify order exists and check permissions
    const order = await Order.findByPk(orderId, {
      include: [{
        model: Client,
        as: 'client',
        include: [{
          model: User,
          as: 'user'
        }]
      }]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check permissions
    const isClient = req.user.role === 'client';
    const isClientOwner = isClient && order.client.user_id === req.user.id;
    const canViewAllContracts = req.user.canViewAllProjects();

    if (!canViewAllContracts && !isClientOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const contracts = await Contract.findAll({
      where: { order_id: orderId },
      order: [['created_at', 'DESC']]
    });

    res.json({ contracts });

  } catch (error) {
    console.error('Get order contracts error:', error);
    res.status(500).json({ error: 'Failed to fetch order contracts' });
  }
});

// Delete contract (Admin only)
router.delete('/:contractId', authenticateToken, requireAdmin, logUserAction('delete_contract'), async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findByPk(contractId);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check if contract can be deleted (only unsigned contracts)
    if (contract.is_signed) {
      return res.status(400).json({ error: 'Signed contracts cannot be deleted' });
    }

    // Delete file if exists
    if (contract.file_path) {
      try {
        await fs.unlink(contract.file_path);
      } catch (error) {
        console.log('Contract file not found for deletion:', error.message);
      }
    }

    await contract.destroy();

    res.json({ message: 'Contract deleted successfully' });

  } catch (error) {
    console.error('Delete contract error:', error);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

module.exports = router;