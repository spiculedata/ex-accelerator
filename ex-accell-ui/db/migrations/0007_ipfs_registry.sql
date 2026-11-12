-- Registry of the packages this install has published to, or imported from, IPFS
-- (src/lib/server/dataSharing/registry.ts). Earlier versions created this table at runtime with the
-- same definition, so IF NOT EXISTS leaves an existing table and its rows untouched.

CREATE TABLE IF NOT EXISTS ipfs_published_packages (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER,
    package_id VARCHAR(255) NOT NULL,
    cid VARCHAR(255) NOT NULL UNIQUE,
    gateway_url TEXT NOT NULL,
    package_name VARCHAR(255),
    description TEXT,
    row_count BIGINT DEFAULT 0,
    file_size_bytes BIGINT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'published',
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_by VARCHAR(255),
    metadata JSONB DEFAULT '{}'
);
