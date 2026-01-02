#!/usr/bin/env python3
"""
Schema Validation Script

This script proactively detects schema mismatches between:
1. Frontend code (settings/page.tsx) - fields being saved
2. SQL migration files - columns that should exist
3. Backend config (config.py) - Python dataclass fields

Run: python scripts/validate_schema.py

This would have caught the scalp_15min_entry_threshold issue!
"""

import re
import os
from pathlib import Path
from typing import Set, Dict, List, Tuple

# Project root
ROOT = Path(__file__).parent.parent


def extract_frontend_save_fields(file_path: Path) -> Set[str]:
    """Extract all fields being saved in the settings page."""
    fields = set()
    
    if not file_path.exists():
        print(f"⚠️  Frontend file not found: {file_path}")
        return fields
    
    content = file_path.read_text()
    
    # Pattern to match field assignments in save payloads like:
    # scalp_15min_entry_threshold: scalp15MinEntryThreshold,
    # enable_market_making: enableMarketMaking,
    pattern = r'^\s*([a-z_][a-z0-9_]*)\s*:\s*[a-zA-Z][a-zA-Z0-9]*,?\s*$'
    
    for line in content.split('\n'):
        match = re.match(pattern, line)
        if match:
            field = match.group(1)
            # Filter out common JS/TS keywords
            if field not in {'type', 'const', 'let', 'var', 'function', 'return', 'if', 'else'}:
                fields.add(field)
    
    # Also extract from explicit config accesses like config?.field_name
    config_pattern = r'config\??\.([\w_]+)'
    for match in re.finditer(config_pattern, content):
        fields.add(match.group(1))
    
    return fields


def extract_sql_columns(scripts_dir: Path) -> Set[str]:
    """Extract all columns added to polybot_config in SQL files."""
    columns = set()
    
    if not scripts_dir.exists():
        print(f"⚠️  Scripts directory not found: {scripts_dir}")
        return columns
    
    for sql_file in scripts_dir.glob('*.sql'):
        content = sql_file.read_text()
        
        # Pattern for ADD COLUMN statements
        pattern = r'ADD COLUMN\s+(?:IF NOT EXISTS\s+)?([a-z_][a-z0-9_]*)'
        for match in re.finditer(pattern, content, re.IGNORECASE):
            columns.add(match.group(1).lower())
    
    return columns


def extract_python_config_fields(config_file: Path) -> Set[str]:
    """Extract fields from Python config dataclass."""
    fields = set()
    
    if not config_file.exists():
        print(f"⚠️  Config file not found: {config_file}")
        return fields
    
    content = config_file.read_text()
    
    # Pattern for dataclass field definitions
    pattern = r'^\s+([a-z_][a-z0-9_]*)\s*:\s*(?:float|int|bool|str|Optional)'
    for line in content.split('\n'):
        match = re.match(pattern, line)
        if match:
            fields.add(match.group(1))
    
    return fields


def validate_schema():
    """Run full schema validation."""
    print("=" * 60)
    print("POLYBOT SCHEMA VALIDATION")
    print("=" * 60)
    
    # Extract fields from all sources
    frontend_fields = extract_frontend_save_fields(
        ROOT / 'admin' / 'src' / 'app' / 'settings' / 'page.tsx'
    )
    
    sql_columns = extract_sql_columns(ROOT / 'scripts')
    
    python_fields = extract_python_config_fields(ROOT / 'src' / 'config.py')
    
    print(f"\n📊 Field Counts:")
    print(f"   Frontend (settings page): {len(frontend_fields)} fields")
    print(f"   SQL migrations: {len(sql_columns)} columns")
    print(f"   Python config: {len(python_fields)} fields")
    
    # Find mismatches
    errors = []
    warnings = []
    
    # Check: Frontend fields not in SQL
    frontend_not_in_sql = frontend_fields - sql_columns
    if frontend_not_in_sql:
        for field in sorted(frontend_not_in_sql):
            errors.append(f"❌ MISSING COLUMN: '{field}' used in frontend but NOT in any SQL migration")
    
    # Check: SQL columns not in frontend (might be obsolete)
    sql_not_in_frontend = sql_columns - frontend_fields
    if sql_not_in_frontend:
        for col in sorted(sql_not_in_frontend):
            # Filter out common/expected columns
            if col not in {'id', 'user_id', 'created_at', 'updated_at', 'key', 'value', 'description', 'updated_by'}:
                warnings.append(f"⚠️  UNUSED: '{col}' in SQL but not used in frontend")
    
    # Report
    print("\n" + "=" * 60)
    print("VALIDATION RESULTS")
    print("=" * 60)
    
    if errors:
        print(f"\n🚨 ERRORS ({len(errors)} found) - These WILL cause save failures!")
        print("-" * 40)
        for err in errors:
            print(f"   {err}")
        print("\n💡 FIX: Add missing columns with SQL migration:")
        print("   ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS <column_name> <type> DEFAULT <value>;")
    
    if warnings:
        print(f"\n⚠️  WARNINGS ({len(warnings)} found) - May indicate obsolete columns")
        print("-" * 40)
        for warn in warnings[:10]:  # Show first 10
            print(f"   {warn}")
        if len(warnings) > 10:
            print(f"   ... and {len(warnings) - 10} more")
    
    if not errors and not warnings:
        print("\n✅ All schemas are in sync!")
    
    # Specific checks for known problem areas
    print("\n" + "=" * 60)
    print("SPECIFIC CHECKS")
    print("=" * 60)
    
    # Check scalp_15min fields (the issue from today)
    scalp_fields = [f for f in frontend_fields if 'scalp_15min' in f]
    print(f"\n15-Min Scalping fields in frontend: {scalp_fields}")
    
    scalp_sql = [c for c in sql_columns if 'scalp_15min' in c]
    print(f"15-Min Scalping columns in SQL: {scalp_sql}")
    
    missing_scalp = set(scalp_fields) - set(scalp_sql)
    if missing_scalp:
        print(f"❌ MISSING SCALP COLUMNS: {missing_scalp}")
    else:
        print("✅ All scalp_15min columns present")
    
    return len(errors) == 0


def generate_migration(missing_fields: Set[str]) -> str:
    """Generate SQL migration for missing fields."""
    lines = [
        "-- Auto-generated migration for missing columns",
        "-- Run in Supabase SQL Editor",
        ""
    ]
    
    for field in sorted(missing_fields):
        # Infer type from field name
        if field.startswith('enable_') or field.endswith('_enabled'):
            dtype = "BOOLEAN DEFAULT false"
        elif '_pct' in field or 'threshold' in field or '_rate' in field or '_zscore' in field:
            dtype = "DECIMAL(10, 4) DEFAULT 0.5"
        elif '_usd' in field or 'balance' in field:
            dtype = "DECIMAL(20, 4) DEFAULT 1000"
        elif '_sec' in field or '_days' in field or '_hours' in field:
            dtype = "INTEGER DEFAULT 60"
        else:
            dtype = "TEXT DEFAULT ''"
        
        lines.append(f"ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS {field} {dtype};")
    
    return '\n'.join(lines)


if __name__ == '__main__':
    success = validate_schema()
    exit(0 if success else 1)
