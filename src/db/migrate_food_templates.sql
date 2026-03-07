-- Migration: Add Food Templates and Daily Food Entries tables
-- Run this against the database to add the new tables

CREATE TABLE IF NOT EXISTS food_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    default_quantity VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'piece',
    calories INTEGER DEFAULT 0,
    is_ai_estimated BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_food_templates_user ON food_templates(user_id);

CREATE TABLE IF NOT EXISTS daily_food_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES food_templates(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity VARCHAR(100),
    unit VARCHAR(50),
    calories INTEGER DEFAULT 0,
    is_eaten BOOLEAN DEFAULT FALSE,
    is_adhoc BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_food_user_date ON daily_food_entries(user_id, date);
