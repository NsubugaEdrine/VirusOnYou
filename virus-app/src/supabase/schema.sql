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

-- Seed data: scans
insert into scans (file_name, package_name, version, sha256, status, threat_level, risk_category, malware_name, risk_score, uploaded_at, completed_at, scan_types) values
('com.example.banking.app', 'com.example.banking.app', '2.1.0', 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890', 'Complete', 'Critical', 'Banking Trojan', 'TrojanSpy.AndroidOS.FakeBank', 85, '2024-11-15 10:30:00+00', '2024-11-15 10:35:00+00', '{Manifest Analysis,Permission Analysis,Code Analysis,Network Analysis}'),
('com.example.social.app', 'com.example.social.app', '3.4.1', 'b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1', 'Complete', 'High', 'Spyware', 'Spyware.AndroidOS.SocialSteal', 72, '2024-11-15 09:00:00+00', '2024-11-15 09:04:00+00', '{Manifest Analysis,Permission Analysis,Code Analysis}'),
('com.example.utility.app', 'com.example.utility.app', '1.0.5', 'c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2', 'Complete', 'Medium', 'Adware', null, 45, '2024-11-15 08:00:00+00', '2024-11-15 08:03:00+00', '{Manifest Analysis,Permission Analysis}'),
('com.example.clean.app', 'com.example.clean.app', '5.2.0', 'd4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2c3', 'Complete', 'Low', 'Clean', null, 12, '2024-11-14 16:00:00+00', '2024-11-14 16:02:00+00', '{Manifest Analysis,Permission Analysis,Code Analysis,Network Analysis}'),
('com.example.games.app', 'com.example.games.app', '1.8.0', 'e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2c3d4', 'Complete', 'Low', 'Riskware', null, 20, '2024-11-14 14:00:00+00', '2024-11-14 14:03:00+00', '{Manifest Analysis,Permission Analysis}'),
('com.example.unknown.app', 'com.example.unknown.app', '0.9.1', 'f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2c3d4e5', 'In Progress', 'None', 'Pending', null, 0, '2024-11-15 11:00:00+00', null, '{Manifest Analysis,Permission Analysis,Code Analysis}'),
('com.example.test.app', 'com.example.test.app', '1.0.0', '7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456', 'Queued', 'None', 'Pending', null, 0, '2024-11-15 11:30:00+00', null, '{Manifest Analysis}')
on conflict do nothing;

-- Seed data: devices
insert into devices (name, os_version, risk_level, last_scan, status, installed_apps) values
('John''s Pixel 7', 'Android 14', 'Critical', '2024-11-15 10:00:00+00', 'Active', '{com.example.banking.app,com.example.social.app}'),
('Marketing S23', 'Android 13', 'High', '2024-11-14 09:00:00+00', 'Active', '{com.example.utility.app,com.example.games.app}'),
('CEO''s iPhone 14', 'iOS 17.1', 'Medium', '2024-11-13 14:00:00+00', 'Active', '{com.example.clean.app}'),
('Dev Team Pixel 6', 'Android 14', 'Low', '2024-11-12 11:00:00+00', 'Active', '{com.example.clean.app,com.example.games.app}'),
('Sales iPhone 13', 'iOS 17.0', 'Low', '2024-11-11 16:00:00+00', 'Active', '{com.example.clean.app}')
on conflict do nothing;

-- Seed data: permissions
insert into permissions (scan_id, name, risk_level, description) values
((select id from scans where package_name='com.example.banking.app' limit 1), 'android.permission.READ_SMS', 'High', 'Read SMS messages - used to intercept OTP and banking codes'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'android.permission.SEND_SMS', 'High', 'Send SMS - used for premium rate SMS fraud'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'android.permission.READ_CONTACTS', 'Medium', 'Read contacts - harvests contact list for propagation'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'android.permission.ACCESS_FINE_LOCATION', 'Medium', 'Fine location access - tracks user location'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'android.permission.RECORD_AUDIO', 'High', 'Record audio - covert surveillance capability'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'android.permission.CAMERA', 'Medium', 'Camera access - covert photo capture'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'android.permission.READ_PHONE_STATE', 'Low', 'Read phone state - device identification'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'android.permission.INTERNET', 'Low', 'Internet access - network communication')
on conflict do nothing;

-- Seed data: network indicators
insert into network_indicators (scan_id, domain, ip_address, indicator_type) values
((select id from scans where package_name='com.example.banking.app' limit 1), 'malicious-c2.com', '192.168.1.100', 'C2 Server'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'data-exfil.com', '10.0.0.50', 'Data Exfiltration')
on conflict do nothing;

-- Seed data: components
insert into components (scan_id, component_type, name, risk_level) values
((select id from scans where package_name='com.example.banking.app' limit 1), 'Activity', 'com.example.MainActivity', 'Low'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'Service', 'com.example.SpyService', 'High'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'Receiver', 'com.example.BootReceiver', 'Medium'),
((select id from scans where package_name='com.example.banking.app' limit 1), 'Provider', 'com.example.DataProvider', 'High')
on conflict do nothing;

-- Seed data: threat intel
insert into threat_intel (package_name, malware_family, severity, first_seen, last_seen, iocs, description) values
('com.example.banking.app', 'FakeBank', 'Critical', '2024-11-15 10:00:00+00', '2024-11-15 10:00:00+00', '[{"type":"SHA256","value":"a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890"},{"type":"Domain","value":"malicious-c2.com"},{"type":"IP","value":"192.168.1.100"}]', 'Banking trojan that intercepts SMS messages and steals banking credentials.'),
('com.example.social.app', 'SocialSteal', 'High', '2024-11-14 09:00:00+00', '2024-11-15 09:00:00+00', '[{"type":"SHA256","value":"b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1"},{"type":"Domain","value":"suspicious-domain.com"}]', 'Spyware targeting social media credentials and personal data.')
on conflict do nothing;
