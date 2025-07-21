-- Window Manufacturing Company Database Schema

-- Create database
CREATE DATABASE window_manufacturing;

-- Use the database
\c window_manufacturing;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User roles enum
CREATE TYPE user_role AS ENUM (
    'director',
    'manager', 
    'supervisor',
    'measurer',
    'delivery_person',
    'installer',
    'client'
);

-- Order status enum
CREATE TYPE order_status AS ENUM (
    'pending',
    'measuring_scheduled',
    'measuring_in_progress',
    'measuring_completed',
    'production_scheduled',
    'in_production',
    'production_completed',
    'delivery_scheduled',
    'in_delivery',
    'delivered',
    'installation_scheduled',
    'installation_in_progress',
    'installation_completed',
    'completed',
    'cancelled'
);

-- Job status enum
CREATE TYPE job_status AS ENUM (
    'assigned',
    'en_route',
    'arrived',
    'in_progress',
    'completed',
    'cancelled'
);

-- Client type enum
CREATE TYPE client_type AS ENUM (
    'individual',
    'legal_entity'
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    profile_image_url VARCHAR(500),
    
    -- Ensure at least one login method exists
    CONSTRAINT check_login_method CHECK (
        email IS NOT NULL OR phone_number IS NOT NULL OR username IS NOT NULL
    )
);

-- Clients table (extends users for client-specific info)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_type client_type NOT NULL,
    company_name VARCHAR(255), -- for legal entities
    tax_id VARCHAR(50), -- for legal entities
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    assigned_manager_id UUID REFERENCES users(id),
    crm_customer_id VARCHAR(100), -- External CRM reference
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email/SMS verification codes
CREATE TABLE verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'email' or 'sms'
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    assigned_manager_id UUID REFERENCES users(id),
    status order_status DEFAULT 'pending',
    total_amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_completion_date DATE,
    actual_completion_date DATE,
    notes TEXT,
    crm_order_id VARCHAR(100), -- External CRM reference
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items (windows/products)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    product_type VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    specifications JSONB, -- Store product specifications as JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table (for workers)
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    assigned_worker_id UUID REFERENCES users(id),
    job_type VARCHAR(50) NOT NULL, -- 'measuring', 'delivery', 'installation'
    status job_status DEFAULT 'assigned',
    scheduled_date DATE,
    scheduled_time TIME,
    location_address TEXT NOT NULL,
    location_coordinates POINT, -- GPS coordinates
    estimated_duration INTEGER, -- in minutes
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job status updates (tracking history)
CREATE TABLE job_status_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    previous_status job_status,
    new_status job_status NOT NULL,
    updated_by UUID REFERENCES users(id),
    notes TEXT,
    location_coordinates POINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contracts table
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    contract_number VARCHAR(50) UNIQUE NOT NULL,
    contract_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500),
    file_url VARCHAR(500),
    signed_date DATE,
    is_signed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'job_assignment', 'status_update', 'general'
    is_read BOOLEAN DEFAULT false,
    related_job_id UUID REFERENCES jobs(id),
    related_order_id UUID REFERENCES orders(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions (for JWT token management)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Company information table
CREATE TABLE company_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    youtube_channel_id VARCHAR(100),
    about_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- YouTube videos table (for About Us section)
CREATE TABLE youtube_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(500),
    duration VARCHAR(20),
    published_at TIMESTAMP,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_jobs_assigned_worker ON jobs(assigned_worker_id);
CREATE INDEX idx_jobs_order_id ON jobs(order_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled_date ON jobs(scheduled_date);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_info_updated_at BEFORE UPDATE ON company_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default company information
INSERT INTO company_info (name, website, email, phone, address, about_text) VALUES (
    'Window Manufacturing Company',
    'https://your-company-website.com',
    'info@windowcompany.com',
    '+1-555-0123',
    '123 Manufacturing St, Industrial District, City, State 12345',
    'We are a leading window manufacturing company with over 20 years of experience in providing high-quality windows and professional installation services. Our team of experts ensures every project meets the highest standards of quality and customer satisfaction.'
);

-- Insert sample YouTube videos
INSERT INTO youtube_videos (video_id, title, description, display_order, is_active) VALUES 
('dQw4w9WgXcQ', 'Company Overview - Window Manufacturing Excellence', 'Learn about our company history, values, and commitment to quality window manufacturing.', 1, true),
('oHg5SJYRHA0', 'Manufacturing Process - Behind the Scenes', 'Take a tour of our state-of-the-art manufacturing facility and see how we create premium windows.', 2, true),
('9bZkp7q19f0', 'Installation Process - Professional Service', 'Watch our expert installation team in action, ensuring perfect window installation every time.', 3, true);