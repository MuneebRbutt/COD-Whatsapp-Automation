/**
 * Tests for Phone Formatter Utility
 * Uses Node.js native assert module.
 * Execute with: node src/utils/phoneFormatter.test.js
 */

const assert = require('assert');
const { normalizePhone } = require('./phoneFormatter');

const testCases = [
  // 1. Standard 11-digit national format starting with 03
  {
    input: '03001234567',
    expected: '923001234567',
    description: 'Standard 11-digit national format'
  },
  // 2. 10-digit national format without leading zero
  {
    input: '3001234567',
    expected: '923001234567',
    description: '10-digit format without leading zero'
  },
  // 3. International format with leading plus
  {
    input: '+923001234567',
    expected: '923001234567',
    description: 'International format with leading plus'
  },
  // 4. International format with leading double zero, dashes
  {
    input: '0092-300-1234567',
    expected: '923001234567',
    description: 'International format with double zero and dashes'
  },
  // 5. International format with country code, dashes
  {
    input: '92-300-1234567',
    expected: '923001234567',
    description: 'International format with country code and dashes'
  },
  // 6. 10-digit format with dash
  {
    input: '300-1234567',
    expected: '923001234567',
    description: '10-digit format with dash'
  },
  // 7. National format with brackets and space
  {
    input: '(0300) 1234567',
    expected: '923001234567',
    description: 'National format with brackets and space'
  }
];

const invalidCases = [
  {
    input: '03001234',
    description: 'Too short'
  },
  {
    input: '0300123456789',
    description: 'Too long'
  },
  {
    input: '04001234567',
    description: 'Invalid Pakistani mobile code (04XX)'
  },
  {
    input: 'abc1234567890',
    description: 'Containing alphabetical characters'
  },
  {
    input: '',
    description: 'Empty string'
  },
  {
    input: null,
    description: 'Null value'
  }
];

console.log('Running phoneFormatter.js tests...\n');
let passed = 0;
let failed = 0;

// Test valid numbers
for (const tc of testCases) {
  try {
    const result = normalizePhone(tc.input);
    assert.strictEqual(result, tc.expected);
    console.log(`[PASS] ${tc.description}: "${tc.input}" -> "${result}"`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${tc.description}: "${tc.input}"`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

// Test invalid numbers (should throw error)
for (const tc of invalidCases) {
  try {
    normalizePhone(tc.input);
    console.error(`[FAIL] ${tc.description}: "${tc.input}" did not throw an error`);
    failed++;
  } catch (err) {
    console.log(`[PASS] ${tc.description}: "${tc.input}" correctly threw error: "${err.message}"`);
    passed++;
  }
}

console.log(`\nTest results: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed successfully!');
}
