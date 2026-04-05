-- Add ticket_transfers table for tracking ticket transfers
CREATE TABLE IF NOT EXISTS ticket_transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    transfer_tx_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_ticket_transfers_ticket_id (ticket_id),
    INDEX idx_ticket_transfers_from_user (from_user_id),
    INDEX idx_ticket_transfers_to_user (to_user_id),
    INDEX idx_ticket_transfers_created_at (created_at)
);

-- Add wallet_address column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255) AFTER email;

-- Add transfer_tx_hash column to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transfer_tx_hash VARCHAR(255) AFTER mint_tx_hash;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_owner_user_id ON tickets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_blockchain_ticket_id ON tickets(blockchain_ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_code ON tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_id ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_status ON ticket_types(status);