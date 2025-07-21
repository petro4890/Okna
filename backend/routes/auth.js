const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User, Client, UserSession, PasswordResetToken, VerificationCode } = require('../models');
const { authenticateToken, createRateLimiter } = require('../middleware/auth');
const { sendEmail, sendSMS } = require('../utils/notifications');

const router = express.Router();

// Rate limiters
const loginLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 attempts per 15 minutes
const passwordResetLimiter = createRateLimiter(60 * 60 * 1000, 3); // 3 attempts per hour
const verificationLimiter = createRateLimiter(60 * 60 * 1000, 5); // 5 attempts per hour

// Validation rules
const registerValidation = [
  body('email').optional().isEmail().normalizeEmail(),
  body('phone_number').optional().isMobilePhone(),
  body('username').optional().isLength({ min: 3, max: 100 }).isAlphanumeric(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('first_name').isLength({ min: 1, max: 100 }).trim(),
  body('last_name').isLength({ min: 1, max: 100 }).trim(),
  body('role').isIn(['director', 'manager', 'supervisor', 'measurer', 'delivery_person', 'installer', 'client'])
];

const loginValidation = [
  body('login').notEmpty().withMessage('Email, phone, or username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Helper function to get device info from request
const getDeviceInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  return {
    user_agent: userAgent,
    ip: req.ip,
    platform: req.headers['x-platform'] || 'unknown',
    app_version: req.headers['x-app-version'] || 'unknown'
  };
};

// Register new user
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      phone_number,
      username,
      password,
      first_name,
      last_name,
      role,
      // Client-specific fields
      client_type,
      company_name,
      tax_id,
      address,
      city,
      state,
      postal_code,
      country
    } = req.body;

    // Ensure at least one login method is provided
    if (!email && !phone_number && !username) {
      return res.status(400).json({ 
        error: 'At least one login method (email, phone, or username) is required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          email ? { email } : null,
          phone_number ? { phone_number } : null,
          username ? { username } : null
        ].filter(Boolean)
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email, phone, or username' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      email,
      phone_number,
      username,
      password_hash,
      first_name,
      last_name,
      role
    });

    // Create client profile if role is client
    if (role === 'client') {
      if (!client_type || !address || !city) {
        await user.destroy();
        return res.status(400).json({ 
          error: 'Client type, address, and city are required for client registration' 
        });
      }

      await Client.create({
        user_id: user.id,
        client_type,
        company_name,
        tax_id,
        address,
        city,
        state,
        postal_code,
        country: country || 'USA'
      });
    }

    // Generate verification codes if email or phone provided
    if (email) {
      const emailCode = await VerificationCode.generateForUser(user.id, 'email');
      await sendEmail(email, 'Email Verification', `Your verification code is: ${emailCode.code}`);
    }

    if (phone_number) {
      const smsCode = await VerificationCode.generateForUser(user.id, 'sms');
      await sendSMS(phone_number, `Your verification code is: ${smsCode.code}`);
    }

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toSafeJSON(),
      verification_required: !!(email || phone_number)
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', loginLimiter, loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { login, password } = req.body;

    // Find user by email, phone, or username
    const user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { email: login },
          { phone_number: login },
          { username: login }
        ]
      },
      include: role === 'client' ? [{
        model: Client,
        as: 'clientProfile'
      }] : []
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken(user.id);
    const tokenHash = UserSession.hashToken(token);

    // Create session
    const deviceInfo = getDeviceInfo(req);
    const session = await UserSession.createForUser(
      user.id,
      tokenHash,
      deviceInfo,
      req.ip
    );

    // Update last login
    await user.update({ last_login: new Date() });

    res.json({
      message: 'Login successful',
      token,
      user: user.toSafeJSON(),
      session_id: session.id
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout user
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Revoke current session
    await req.session.revoke();

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Logout from all devices
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    // Revoke all sessions for user
    await UserSession.revokeAllForUser(req.user.id);

    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Request password reset
router.post('/forgot-password', passwordResetLimiter, [
  body('login').notEmpty().withMessage('Email, phone, or username is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { login } = req.body;

    // Find user
    const user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { email: login },
          { phone_number: login },
          { username: login }
        ]
      }
    });

    // Always return success to prevent user enumeration
    if (!user) {
      return res.json({ message: 'If the account exists, a reset code will be sent' });
    }

    // Revoke existing reset tokens
    await PasswordResetToken.revokeAllForUser(user.id);

    // Generate reset token
    const resetToken = await PasswordResetToken.generateForUser(user.id);

    // Send reset code via email or SMS
    if (user.email) {
      await sendEmail(
        user.email,
        'Password Reset',
        `Your password reset code is: ${resetToken.token.substring(0, 8).toUpperCase()}`
      );
    } else if (user.phone_number) {
      await sendSMS(
        user.phone_number,
        `Your password reset code is: ${resetToken.token.substring(0, 8).toUpperCase()}`
      );
    }

    res.json({ message: 'If the account exists, a reset code will be sent' });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Password reset request failed' });
  }
});

// Reset password with token
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    // Find valid reset token
    const resetToken = await PasswordResetToken.findValidToken(token);
    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(password, 12);

    // Update user password
    await resetToken.user.update({ password_hash });

    // Mark token as used
    await resetToken.markAsUsed();

    // Revoke all user sessions
    await UserSession.revokeAllForUser(resetToken.user.id);

    res.json({ message: 'Password reset successful' });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Verify email or phone
router.post('/verify', verificationLimiter, [
  body('code').isLength({ min: 6, max: 6 }).isNumeric(),
  body('type').isIn(['email', 'sms'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code, type, user_id } = req.body;

    // Find valid verification code
    const verificationCode = await VerificationCode.findValidCode(user_id, code, type);
    if (!verificationCode) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Mark code as used
    await verificationCode.markAsUsed();

    // Update user verification status
    const updateData = {};
    if (type === 'email') {
      updateData.email_verified = true;
    } else if (type === 'sms') {
      updateData.phone_verified = true;
    }

    await verificationCode.user.update(updateData);

    res.json({ 
      message: `${type === 'email' ? 'Email' : 'Phone'} verified successfully`,
      verified: true
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend verification code
router.post('/resend-verification', verificationLimiter, [
  body('type').isIn(['email', 'sms']),
  body('user_id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, user_id } = req.body;

    // Find user
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check rate limiting
    const canSend = await VerificationCode.canSendNewCode(user_id, type);
    if (!canSend) {
      return res.status(429).json({ error: 'Too many verification attempts, please try again later' });
    }

    // Revoke existing codes
    await VerificationCode.revokeAllForUser(user_id, type);

    // Generate new code
    const verificationCode = await VerificationCode.generateForUser(user_id, type);

    // Send code
    if (type === 'email' && user.email) {
      await sendEmail(user.email, 'Email Verification', `Your verification code is: ${verificationCode.code}`);
    } else if (type === 'sms' && user.phone_number) {
      await sendSMS(user.phone_number, `Your verification code is: ${verificationCode.code}`);
    } else {
      return res.status(400).json({ error: `No ${type} address found for user` });
    }

    res.json({ message: 'Verification code sent' });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
      include: req.user.role === 'client' ? [{
        model: Client,
        as: 'clientProfile'
      }] : []
    });

    res.json({ user: user.toSafeJSON() });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Get user sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await UserSession.getUserActiveSessions(req.user.id);
    
    const sessionData = sessions.map(session => ({
      id: session.id,
      device_name: session.getDeviceName(),
      location: session.getLocationInfo(),
      created_at: session.created_at,
      expires_at: session.expires_at,
      is_current: session.id === req.session.id
    }));

    res.json({ sessions: sessionData });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get user sessions' });
  }
});

// Revoke specific session
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await UserSession.findOne({
      where: {
        id: sessionId,
        user_id: req.user.id
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await session.revoke();

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

module.exports = router;