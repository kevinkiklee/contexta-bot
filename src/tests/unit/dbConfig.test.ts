import { describe, it, expect } from 'vitest';
import { parseDbConfig } from '../../db/index.js';

describe('parseDbConfig', () => {
  it('enables SSL and strips query string for production URLs', () => {
    const result = parseDbConfig('postgresql://host:5432/db?sslmode=require');
    expect(result.connectionString).toBe('postgresql://host:5432/db');
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('disables SSL when sslmode=disable', () => {
    const result = parseDbConfig('postgresql://host:5432/db?sslmode=disable');
    expect(result.ssl).toBe(false);
  });

  it('enables SSL when sslmode=require', () => {
    const result = parseDbConfig('postgresql://host:5432/db?sslmode=require');
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('disables SSL for localhost URLs regardless of sslmode', () => {
    const result = parseDbConfig('postgresql://localhost:5432/db?sslmode=require');
    expect(result.ssl).toBe(false);
  });

  it('disables SSL for 127.0.0.1 URLs', () => {
    const result = parseDbConfig('postgresql://127.0.0.1:5432/db');
    expect(result.ssl).toBe(false);
  });

  it('disables SSL when disableSslEnv is true', () => {
    const result = parseDbConfig('postgresql://prod-host:5432/db', 'true');
    expect(result.ssl).toBe(false);
  });

  it('strips multiple query params, keeping base URL intact', () => {
    const result = parseDbConfig('postgresql://host:5432/db?sslmode=require&timeout=30');
    expect(result.connectionString).toBe('postgresql://host:5432/db');
  });

  it('handles empty URL gracefully', () => {
    const result = parseDbConfig('');
    expect(result.connectionString).toBe('');
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('enables SSL for production URL with no sslmode param', () => {
    const result = parseDbConfig('postgresql://prod-host:5432/db');
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
  });
});
