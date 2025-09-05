-- Add division_code field to vendor_quotes table for proper division filtering
ALTER TABLE vendor_quotes 
ADD COLUMN IF NOT EXISTS division_code VARCHAR(10);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vendor_quotes_division_code ON vendor_quotes(division_code, project_id);