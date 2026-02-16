import { test } from 'node:test';
import assert from 'node:assert';
import { calculateStatus, getStatusEmoji, calculateAge, daysUntilExpiry } from '../lib/status.js';

test('status: healthy secret within rotation policy', () => {
  const secret = {
    name: 'test-key',
    provider: 'test',
    type: 'api_key',
    createdAt: new Date().toISOString().split('T')[0],
    lastRotated: new Date().toISOString().split('T')[0],
    rotationPolicy: 90,
    expiresAt: null
  };
  
  assert.strictEqual(calculateStatus(secret), 'healthy');
});

test('status: warning when >75% through rotation policy', () => {
  const date = new Date();
  date.setDate(date.getDate() - 70); // 70 days ago (>75% of 90 days)
  
  const secret = {
    name: 'test-key',
    lastRotated: date.toISOString().split('T')[0],
    rotationPolicy: 90,
    expiresAt: null
  };
  
  assert.strictEqual(calculateStatus(secret), 'warning');
});

test('status: critical when past rotation policy', () => {
  const date = new Date();
  date.setDate(date.getDate() - 95); // 95 days ago (past 90 day policy)
  
  const secret = {
    name: 'test-key',
    lastRotated: date.toISOString().split('T')[0],
    rotationPolicy: 90,
    expiresAt: null
  };
  
  assert.strictEqual(calculateStatus(secret), 'critical');
});

test('status: warning when <30 days to expiry', () => {
  const date = new Date();
  date.setDate(date.getDate() + 20); // Expires in 20 days
  
  const secret = {
    name: 'test-key',
    expiresAt: date.toISOString().split('T')[0],
    lastRotated: new Date().toISOString().split('T')[0],
    rotationPolicy: 90
  };
  
  assert.strictEqual(calculateStatus(secret), 'warning');
});

test('status: critical when <7 days to expiry', () => {
  const date = new Date();
  date.setDate(date.getDate() + 5); // Expires in 5 days
  
  const secret = {
    name: 'test-key',
    expiresAt: date.toISOString().split('T')[0],
    lastRotated: new Date().toISOString().split('T')[0],
    rotationPolicy: 90
  };
  
  assert.strictEqual(calculateStatus(secret), 'critical');
});

test('status: expired when past expiry date', () => {
  const date = new Date();
  date.setDate(date.getDate() - 5); // Expired 5 days ago
  
  const secret = {
    name: 'test-key',
    expiresAt: date.toISOString().split('T')[0],
    lastRotated: new Date().toISOString().split('T')[0],
    rotationPolicy: 90
  };
  
  assert.strictEqual(calculateStatus(secret), 'expired');
});

test('status: getStatusEmoji returns correct emoji', () => {
  assert.strictEqual(getStatusEmoji('healthy'), '🟢');
  assert.strictEqual(getStatusEmoji('warning'), '🟡');
  assert.strictEqual(getStatusEmoji('critical'), '🔴');
  assert.strictEqual(getStatusEmoji('expired'), '⛔');
});

test('status: calculateAge returns correct age', () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  
  const secret = {
    createdAt: date.toISOString().split('T')[0],
    lastRotated: date.toISOString().split('T')[0]
  };
  
  const age = calculateAge(secret);
  assert.ok(age >= 30 && age <= 31, 'Age should be approximately 30 days');
});

test('status: daysUntilExpiry returns correct days', () => {
  const date = new Date();
  date.setDate(date.getDate() + 45);
  
  const secret = {
    expiresAt: date.toISOString().split('T')[0]
  };
  
  const days = daysUntilExpiry(secret);
  assert.ok(days >= 44 && days <= 46, 'Days should be approximately 45');
});
