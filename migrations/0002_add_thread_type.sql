-- Add type column to threads table for distinguishing between discussions and comments
-- Default to 'discussion' for backward compatibility with existing threads

ALTER TABLE threads ADD COLUMN type TEXT DEFAULT 'discussion' CHECK (type IN ('discussion', 'comment'));

-- Create index for filtering by type
CREATE INDEX IF NOT EXISTS idx_threads_type ON threads(session_id, type);
