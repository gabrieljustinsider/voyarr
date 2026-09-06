-- Migration: Create billers, provider_billers, and link to subscriptions & providers
CREATE TABLE IF NOT EXISTS billers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    url VARCHAR(500),
    support_email VARCHAR(255),
    support_phone VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_billers_name ON billers(name);

-- Link providers to default_biller_id if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'providers' AND column_name = 'default_biller_id'
    ) THEN
        ALTER TABLE providers ADD COLUMN default_biller_id INTEGER REFERENCES billers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Provider Billers junction table (Provider's specific billing instance & plan options)
CREATE TABLE IF NOT EXISTS provider_billers (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    biller_id INTEGER NOT NULL REFERENCES billers(id) ON DELETE CASCADE,
    merchant_account_label VARCHAR(255),
    supported_cycles JSONB DEFAULT '["monthly", "annual"]'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uix_provider_biller UNIQUE (provider_id, biller_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_billers_provider_id ON provider_billers(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_billers_biller_id ON provider_billers(biller_id);

-- Update subscriptions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'provider_biller_id'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN provider_biller_id INTEGER REFERENCES provider_billers(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_biller_id ON subscriptions(provider_biller_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'biller_id'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN biller_id INTEGER REFERENCES billers(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_subscriptions_biller_id ON subscriptions(biller_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'charge_type'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN charge_type VARCHAR(50) DEFAULT 'bulk';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'installment_frequency'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN installment_frequency VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'subscription_id'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN subscription_id VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'order_number'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN order_number VARCHAR(255);
    END IF;
END $$;
