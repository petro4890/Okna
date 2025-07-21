const jwt = require('jsonwebtoken');
const { User, UserSession } = require('../models');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if session exists and is valid
    const tokenHash = UserSession.hashToken(token);
    const session = await UserSession.findByTokenHash(tokenHash);
    
    if (!session || !session.isValid()) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get user details
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Attach user and session to request
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Middleware to check user roles
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: userRole
      });
    }

    next();
  };
};

// Middleware for admin roles (Director, Manager)
const requireAdmin = requireRole(['director', 'manager']);

// Middleware for management roles (Director, Manager, Supervisor)
const requireManagement = requireRole(['director', 'manager', 'supervisor']);

// Middleware for worker roles
const requireWorker = requireRole(['measurer', 'delivery_person', 'installer']);

// Middleware for client role
const requireClient = requireRole(['client']);

// Middleware to check if user can manage other users
const requireUserManagement = (req, res, next) => {
  if (!req.user || !req.user.canManageUsers()) {
    return res.status(403).json({ error: 'User management permissions required' });
  }
  next();
};

// Middleware to check if user can view all projects
const requireProjectView = (req, res, next) => {
  if (!req.user || !req.user.canViewAllProjects()) {
    return res.status(403).json({ error: 'Project view permissions required' });
  }
  next();
};

// Middleware to check if user owns resource or has admin access
const requireOwnershipOrAdmin = (resourceUserIdField = 'user_id') => {
  return (req, res, next) => {
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (req.user.canManageUsers() || req.user.id === resourceUserId) {
      return next();
    }
    
    return res.status(403).json({ error: 'Access denied: insufficient permissions' });
  };
};

// Middleware to validate user is active
const requireActiveUser = (req, res, next) => {
  if (!req.user || !req.user.is_active) {
    return res.status(403).json({ error: 'Account is inactive' });
  }
  next();
};

// Middleware to check email verification for sensitive operations
const requireEmailVerification = (req, res, next) => {
  if (!req.user || !req.user.email_verified) {
    return res.status(403).json({ 
      error: 'Email verification required for this operation',
      verification_required: true
    });
  }
  next();
};

// Rate limiting middleware for sensitive operations
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 5) => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = req.ip + (req.user ? req.user.id : '');
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!attempts.has(key)) {
      attempts.set(key, []);
    }
    
    const userAttempts = attempts.get(key);
    const recentAttempts = userAttempts.filter(time => time > windowStart);
    
    if (recentAttempts.length >= max) {
      return res.status(429).json({ 
        error: 'Too many attempts, please try again later',
        retry_after: Math.ceil((recentAttempts[0] + windowMs - now) / 1000)
      });
    }
    
    recentAttempts.push(now);
    attempts.set(key, recentAttempts);
    
    next();
  };
};

// Middleware to log user actions
const logUserAction = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log successful actions (status < 400)
      if (res.statusCode < 400) {
        console.log(`User Action: ${req.user?.id} (${req.user?.role}) performed ${action}`, {
          userId: req.user?.id,
          userRole: req.user?.role,
          action: action,
          method: req.method,
          path: req.path,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireManagement,
  requireWorker,
  requireClient,
  requireUserManagement,
  requireProjectView,
  requireOwnershipOrAdmin,
  requireActiveUser,
  requireEmailVerification,
  createRateLimiter,
  logUserAction
};