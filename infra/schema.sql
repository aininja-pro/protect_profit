-- Operation Protect Profit Database Schema
-- Construction bid management and comparison system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users and Authentication (handled by Supabase Auth, but we need profile data)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'PM' CHECK (role IN ('PM', 'Approver', 'Admin', 'Viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    project_type VARCHAR(100),
    target_margin DECIMAL(5,2), -- Percentage
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'draft', 'completed', 'archived')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget Items (from uploaded spreadsheets)
CREATE TABLE IF NOT EXISTS budget_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    division VARCHAR(10), -- CSI Division code (e.g., '03', '16')
    description TEXT NOT NULL,
    quantity DECIMAL(12,2),
    unit VARCHAR(20), -- e.g., 'CY', 'SF', 'EA', 'LS'
    unit_cost DECIMAL(12,2),
    total_cost DECIMAL(12,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Files (for uploaded documents)
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL, -- Supabase storage path
    file_size INTEGER,
    file_type VARCHAR(100), -- MIME type
    file_category VARCHAR(50) CHECK (file_category IN ('budget', 'quote', 'workorder')),
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor Quotes (parsed from uploaded files)
CREATE TABLE IF NOT EXISTS vendor_quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id),
    vendor_name VARCHAR(255) NOT NULL,
    trade VARCHAR(100), -- e.g., 'Electrical', 'Concrete', 'Framing'
    total_amount DECIMAL(12,2),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'parsed', 'normalized', 'approved', 'rejected')),
    parsing_confidence DECIMAL(3,2), -- 0.00 to 1.00
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quote Line Items (individual items from vendor quotes)
CREATE TABLE IF NOT EXISTS quote_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID REFERENCES vendor_quotes(id) ON DELETE CASCADE,
    division VARCHAR(10),
    description TEXT NOT NULL,
    quantity DECIMAL(12,2),
    unit VARCHAR(20),
    unit_cost DECIMAL(12,2),
    total_cost DECIMAL(12,2),
    notes TEXT,
    confidence_score DECIMAL(3,2), -- AI parsing confidence
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comparison Flags (issues found during comparison)
CREATE TABLE IF NOT EXISTS comparison_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    budget_item_id UUID REFERENCES budget_items(id),
    quote_item_id UUID REFERENCES quote_line_items(id),
    flag_type VARCHAR(50) NOT NULL CHECK (flag_type IN ('MISSING', 'OUTLIER', 'UNIT_MISMATCH', 'SCOPE_DIFFERENCE')),
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Work Orders (generated final documents)
CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor_name VARCHAR(255) NOT NULL,
    trade VARCHAR(100),
    total_amount DECIMAL(12,2),
    file_path VARCHAR(500), -- Generated document path
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'completed')),
    generated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Log (immutable record of all actions)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL, -- e.g., 'budget_uploaded', 'quote_parsed', 'workorder_generated'
    entity_type VARCHAR(50), -- e.g., 'project', 'budget', 'quote'
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_items_project_id ON budget_items(project_id);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotes_project_id ON vendor_quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id ON quote_line_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_comparison_flags_project_id ON comparison_flags(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Row Level Security (RLS) Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be refined based on business rules)
CREATE POLICY "Users can view their own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Project access based on role and project assignment
CREATE POLICY "Users can access projects they're assigned to" ON projects FOR ALL USING (
    auth.uid() = created_by OR 
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role IN ('Admin', 'Approver')
    )
);

-- Cascade policies for project-related data
CREATE POLICY "Project data access follows project access" ON budget_items FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = budget_items.project_id AND (
        auth.uid() = created_by OR 
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('Admin', 'Approver'))
    ))
);

CREATE POLICY "Project data access follows project access" ON files FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = files.project_id AND (
        auth.uid() = created_by OR 
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('Admin', 'Approver'))
    ))
);

CREATE POLICY "Project data access follows project access" ON vendor_quotes FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = vendor_quotes.project_id AND (
        auth.uid() = created_by OR 
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('Admin', 'Approver'))
    ))
);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budget_items_updated_at BEFORE UPDATE ON budget_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendor_quotes_updated_at BEFORE UPDATE ON vendor_quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();