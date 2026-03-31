-- Supabase Schema for Management System

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Employees
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    names TEXT NOT NULL,
    role TEXT NOT NULL,
    pay_type TEXT NOT NULL,
    base_salary NUMERIC,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, On Leave, Inactive
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cash Advances (C.A.)
CREATE TABLE IF NOT EXISTS cash_advances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_name TEXT NOT NULL,
    date DATE NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Deducted, Written-off
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Packing Entries
CREATE TABLE IF NOT EXISTS packing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    cook_name TEXT NOT NULL,
    pack_size INTEGER NOT NULL,
    packs_produced INTEGER NOT NULL,
    production_type TEXT DEFAULT 'Packed',
    leftover_sticks INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "orderNumber" TEXT NOT NULL,
    client TEXT NOT NULL,
    deadline DATE NOT NULL,
    "paymentStatus" TEXT CHECK ("paymentStatus" IN ('Unpaid', 'Partial', 'Paid')),
    "orderStatus" TEXT CHECK ("orderStatus" IN ('Pending', 'Delivered')),
    total NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    "packSize" INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    "pricePerPack" NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Raw Material', 'Operational')),
    item TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
