-- VirusOnYou Database Schema
-- Run this in Supabase SQL Editor to set up your tables

create extension if not exists "uuid-ossp";

create table if not exists scans (
  id uuid primary key default uuid_generate_v4(),
  file_name text not null,
  package_name text not null,
  version text not null default '1.0.0',
  sha256 text not null,
  status text not null default 'Queued' check (status in ('Queued', 'In Progress', 'Complete', 'Failed')),
  threat_level text not null default 'None' check (threat_level in ('Critical', 'High', 'Medium', 'Low', 'None')),
  risk_category text not null default 'Pending',
  malware_name text,
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  uploaded_at timestamptz not null default now(),
  completed_at timestamptz,
  scan_types text[] not null default '{}'
);

create table if not exists devices (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  os_version text not null,
  risk_level text not null default 'Low' check (risk_level in ('Critical', 'High', 'Medium', 'Low')),
  last_scan timestamptz not null default now(),
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  installed_apps text[] not null default '{}'
);

create table if not exists permissions (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references scans(id) on delete cascade,
  name text not null,
  risk_level text not null default 'Low' check (risk_level in ('Critical', 'High', 'Medium', 'Low')),
  description text not null default ''
);

create table if not exists network_indicators (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references scans(id) on delete cascade,
  domain text not null,
  ip_address text not null,
  indicator_type text not null default 'Suspicious'
);

create table if not exists components (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references scans(id) on delete cascade,
  component_type text not null check (component_type in ('Activity', 'Service', 'Receiver', 'Provider')),
  name text not null,
  risk_level text not null default 'Low' check (risk_level in ('Critical', 'High', 'Medium', 'Low'))
);

create table if not exists threat_intel (
  id uuid primary key default uuid_generate_v4(),
  package_name text not null,
  malware_family text not null,
  severity text not null check (severity in ('Critical', 'High', 'Medium', 'Low')),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  iocs jsonb not null default '[]',
  description text not null default ''
);

create index if not exists idx_scans_status on scans(status);
create index if not exists idx_scans_threat_level on scans(threat_level);
create index if not exists idx_scans_uploaded_at on scans(uploaded_at desc);
create index if not exists idx_devices_risk_level on devices(risk_level);
create index if not exists idx_permissions_scan_id on permissions(scan_id);
create index if not exists idx_network_indicators_scan_id on network_indicators(scan_id);
create index if not exists idx_components_scan_id on components(scan_id);
create index if not exists idx_threat_intel_severity on threat_intel(severity);
create index if not exists idx_threat_intel_package_name on threat_intel(package_name);
