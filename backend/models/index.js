const { Sequelize } = require('sequelize');
require('dotenv').config();

// Database connection
const sequelize = new Sequelize(
  process.env.DB_NAME || 'window_manufacturing',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Import models
const User = require('./User')(sequelize);
const Client = require('./Client')(sequelize);
const Order = require('./Order')(sequelize);
const OrderItem = require('./OrderItem')(sequelize);
const Job = require('./Job')(sequelize);
const JobStatusUpdate = require('./JobStatusUpdate')(sequelize);
const Contract = require('./Contract')(sequelize);
const Notification = require('./Notification')(sequelize);
const PasswordResetToken = require('./PasswordResetToken')(sequelize);
const VerificationCode = require('./VerificationCode')(sequelize);
const UserSession = require('./UserSession')(sequelize);
const CompanyInfo = require('./CompanyInfo')(sequelize);
const YoutubeVideo = require('./YoutubeVideo')(sequelize);

// Define associations
User.hasOne(Client, { foreignKey: 'user_id', as: 'clientProfile' });
Client.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Client.belongsTo(User, { foreignKey: 'assigned_manager_id', as: 'assignedManager' });
User.hasMany(Client, { foreignKey: 'assigned_manager_id', as: 'managedClients' });

Client.hasMany(Order, { foreignKey: 'client_id', as: 'orders' });
Order.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

Order.belongsTo(User, { foreignKey: 'assigned_manager_id', as: 'assignedManager' });
User.hasMany(Order, { foreignKey: 'assigned_manager_id', as: 'managedOrders' });

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Order.hasMany(Job, { foreignKey: 'order_id', as: 'jobs' });
Job.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Job.belongsTo(User, { foreignKey: 'assigned_worker_id', as: 'assignedWorker' });
User.hasMany(Job, { foreignKey: 'assigned_worker_id', as: 'assignedJobs' });

Job.hasMany(JobStatusUpdate, { foreignKey: 'job_id', as: 'statusUpdates' });
JobStatusUpdate.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });

JobStatusUpdate.belongsTo(User, { foreignKey: 'updated_by', as: 'updatedBy' });
User.hasMany(JobStatusUpdate, { foreignKey: 'updated_by', as: 'statusUpdates' });

Order.hasMany(Contract, { foreignKey: 'order_id', as: 'contracts' });
Contract.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Notification.belongsTo(Job, { foreignKey: 'related_job_id', as: 'relatedJob' });
Notification.belongsTo(Order, { foreignKey: 'related_order_id', as: 'relatedOrder' });

User.hasMany(PasswordResetToken, { foreignKey: 'user_id', as: 'passwordResetTokens' });
PasswordResetToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(VerificationCode, { foreignKey: 'user_id', as: 'verificationCodes' });
VerificationCode.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(UserSession, { foreignKey: 'user_id', as: 'sessions' });
UserSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize,
  User,
  Client,
  Order,
  OrderItem,
  Job,
  JobStatusUpdate,
  Contract,
  Notification,
  PasswordResetToken,
  VerificationCode,
  UserSession,
  CompanyInfo,
  YoutubeVideo
};