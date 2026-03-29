-- Supabase Schema for Management System

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Packing Entries
CREATE TABLE IF NOT EXISTS packing_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    cook TEXT NOT NULL,
    "packSize" INTEGER NOT NULL,
    packs INTEGER NOT NULL,
    pieces INTEGER NOT NULL,
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
