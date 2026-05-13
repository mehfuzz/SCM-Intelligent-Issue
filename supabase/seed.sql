-- Seed master data for SCM Issue Management Portal

-- Priority config singleton
insert into priority_config (id, impact_weight, effort_weight, p1_min_score, p2_min_score)
values (true, 0.7, 0.3, 85, 60)
on conflict (id) do nothing;

-- SLA policies (response/resolution in minutes)
insert into sla_policies (priority, response_minutes, resolution_minutes) values
  ('P0', 240,    1440),    -- 4h / 24h
  ('P1', 1440,   10080),   -- 1d / 7d
  ('P2', 4320,   30240),   -- 3d / 21d
  ('P3', 7200,   64800)    -- 5d / 45d
on conflict (priority) do update
  set response_minutes = excluded.response_minutes,
      resolution_minutes = excluded.resolution_minutes,
      updated_at = now();

-- Workflow stages
insert into workflow_stages (stage, display_name, sort_order) values
  ('draft','Draft',0),
  ('submitted','Submitted',10),
  ('coe_triage','COE Triage',20),
  ('poc_assigned','POC Assigned',30),
  ('requirement_clarification','Requirement Clarification',40),
  ('brd_acceptance','BRD Acceptance',50),
  ('solution_design','Solution Design',60),
  ('mih_ccb_approval','MIH & CCB Approval',70),
  ('development_sit','Development & SIT',80),
  ('uat','UAT',90),
  ('go_live','Go-Live',100),
  ('pending_validation','Pending Validation',110),
  ('closed','Closed',120),
  ('reopened','Reopened',130),
  ('rejected','Rejected',140)
on conflict (stage) do nothing;

-- Categories
insert into categories (code, name, sort_order) values
  ('process_gap','Process Gap',1),
  ('system_bug','System / Technical Bug',2),
  ('compliance','Compliance & Risk',3),
  ('automation','Automation Opportunity',4),
  ('data_quality','Data Quality',5),
  ('visibility','Visibility Gap',6),
  ('dashboard','Dashboard & Reporting',7),
  ('new_development','New Development',8)
on conflict (code) do nothing;

-- BRD templates per category (one base section list per type)
insert into brd_templates (category_id, name, sections)
select c.id,
  case c.code
    when 'automation' then 'Automation BRD'
    when 'dashboard' then 'Dashboard BRD'
    when 'system_bug' then 'Technical Fix BRD'
    when 'compliance' then 'Risk & Compliance BRD'
    when 'new_development' then 'Product Requirement BRD'
    when 'process_gap' then 'Process Improvement BRD'
    else c.name || ' BRD'
  end,
  '[
    "Business Context",
    "Problem Statement",
    "Current State Process",
    "Proposed Future State",
    "Stakeholders",
    "Business Impact",
    "Technical Dependencies",
    "Risks",
    "Assumptions",
    "Success Metrics",
    "UAT Requirements",
    "Go-Live Checklist"
  ]'::jsonb
from categories c
on conflict do nothing;

-- Example modules
insert into modules (code, name) values
  ('PROCUREMENT','Procurement'),
  ('INVENTORY','Inventory'),
  ('LOGISTICS','Logistics'),
  ('VENDOR','Vendor Management'),
  ('CONTRACTS','Contracts'),
  ('FINANCE_SCM','SCM Finance')
on conflict (code) do nothing;
