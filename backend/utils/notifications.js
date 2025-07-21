const nodemailer = require('nodemailer');
const twilio = require('twilio');
require('dotenv').config();

// Email transporter setup
const emailTransporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Twilio client setup
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Send email function
const sendEmail = async (to, subject, text, html = null) => {
  try {
    if (!process.env.EMAIL_USER) {
      console.log('Email not configured, would send:', { to, subject, text });
      return { success: true, message: 'Email simulation (not configured)' };
    }

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || 'Window Manufacturing'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
};

// Send SMS function
const sendSMS = async (to, message) => {
  try {
    if (!twilioClient) {
      console.log('SMS not configured, would send:', { to, message });
      return { success: true, message: 'SMS simulation (not configured)' };
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    });

    console.log('SMS sent:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error: error.message };
  }
};

// Send push notification (placeholder for future implementation)
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    // This would integrate with Firebase Cloud Messaging or similar service
    console.log('Push notification would be sent:', { userId, title, body, data });
    
    // For now, we'll use Socket.IO to send real-time notifications
    const io = require('../server').io;
    if (io) {
      io.to(`user_${userId}`).emit('notification', {
        title,
        body,
        data,
        timestamp: new Date().toISOString()
      });
    }
    
    return { success: true, message: 'Push notification sent via Socket.IO' };
  } catch (error) {
    console.error('Push notification error:', error);
    return { success: false, error: error.message };
  }
};

// Send contract via email
const sendContractEmail = async (to, contractData, attachmentPath = null) => {
  try {
    const subject = `Contract ${contractData.contract_number} - ${contractData.contract_type}`;
    const text = `
Dear ${contractData.client_name},

Please find attached your contract ${contractData.contract_number}.

Contract Details:
- Contract Number: ${contractData.contract_number}
- Type: ${contractData.contract_type}
- Order Number: ${contractData.order_number}

If you have any questions, please contact us.

Best regards,
${process.env.COMPANY_NAME || 'Window Manufacturing Company'}
    `;

    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1C77FF;">Contract ${contractData.contract_number}</h2>
  
  <p>Dear ${contractData.client_name},</p>
  
  <p>Please find attached your contract ${contractData.contract_number}.</p>
  
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #333;">Contract Details:</h3>
    <ul style="list-style: none; padding: 0;">
      <li><strong>Contract Number:</strong> ${contractData.contract_number}</li>
      <li><strong>Type:</strong> ${contractData.contract_type}</li>
      <li><strong>Order Number:</strong> ${contractData.order_number}</li>
    </ul>
  </div>
  
  <p>If you have any questions, please contact us.</p>
  
  <p>Best regards,<br>
  <strong>${process.env.COMPANY_NAME || 'Window Manufacturing Company'}</strong></p>
</div>
    `;

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || 'Window Manufacturing'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    };

    if (attachmentPath) {
      mailOptions.attachments = [{
        filename: `${contractData.contract_number}.pdf`,
        path: attachmentPath
      }];
    }

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Contract email sent:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Contract email send error:', error);
    return { success: false, error: error.message };
  }
};

// Send order status update notification
const sendOrderStatusNotification = async (user, order, oldStatus, newStatus) => {
  try {
    const notifications = [];

    // Email notification
    if (user.email && user.email_verified) {
      const subject = `Order ${order.order_number} Status Update`;
      const text = `Your order ${order.order_number} status has been updated from ${oldStatus} to ${newStatus}.`;
      
      const emailResult = await sendEmail(user.email, subject, text);
      notifications.push({ type: 'email', result: emailResult });
    }

    // SMS notification
    if (user.phone_number && user.phone_verified) {
      const message = `Order ${order.order_number} status updated: ${newStatus}`;
      
      const smsResult = await sendSMS(user.phone_number, message);
      notifications.push({ type: 'sms', result: smsResult });
    }

    // Push notification
    const pushResult = await sendPushNotification(
      user.id,
      'Order Status Update',
      `Order ${order.order_number} is now ${newStatus}`,
      { orderId: order.id, status: newStatus }
    );
    notifications.push({ type: 'push', result: pushResult });

    return { success: true, notifications };
  } catch (error) {
    console.error('Order status notification error:', error);
    return { success: false, error: error.message };
  }
};

// Send job assignment notification
const sendJobAssignmentNotification = async (worker, job, order) => {
  try {
    const notifications = [];

    // Email notification
    if (worker.email && worker.email_verified) {
      const subject = `New Job Assignment - ${job.job_type}`;
      const text = `You have been assigned a new ${job.job_type} job for order ${order.order_number} at ${job.location_address}.`;
      
      const emailResult = await sendEmail(worker.email, subject, text);
      notifications.push({ type: 'email', result: emailResult });
    }

    // SMS notification
    if (worker.phone_number && worker.phone_verified) {
      const message = `New ${job.job_type} job assigned: ${job.location_address}. Order: ${order.order_number}`;
      
      const smsResult = await sendSMS(worker.phone_number, message);
      notifications.push({ type: 'sms', result: smsResult });
    }

    // Push notification
    const pushResult = await sendPushNotification(
      worker.id,
      'New Job Assignment',
      `${job.job_type} job at ${job.location_address}`,
      { jobId: job.id, orderId: order.id, jobType: job.job_type }
    );
    notifications.push({ type: 'push', result: pushResult });

    return { success: true, notifications };
  } catch (error) {
    console.error('Job assignment notification error:', error);
    return { success: false, error: error.message };
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    await emailTransporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
};

// Test SMS configuration
const testSMSConfig = async () => {
  try {
    if (!twilioClient) {
      console.log('SMS not configured');
      return false;
    }
    
    // Test by fetching account info
    const account = await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    console.log('SMS configuration is valid, account:', account.friendlyName);
    return true;
  } catch (error) {
    console.error('SMS configuration error:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendSMS,
  sendPushNotification,
  sendContractEmail,
  sendOrderStatusNotification,
  sendJobAssignmentNotification,
  testEmailConfig,
  testSMSConfig
};