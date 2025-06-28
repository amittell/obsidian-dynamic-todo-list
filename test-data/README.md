# Development Notes

This directory contains test files for the Dynamic Todo List plugin. Each file targets specific test scenarios and should be used with TEST_PLAN.md.

## Test Files Structure

### Basic Tasks (1-basic-tasks.md)
Core functionality tests:
- Note-level tag detection
- Task format recognition
- Task state handling

### Settings Tests (2-settings-test.md)
Configuration tests:
- Custom note tags
- Task prefix formats
- Format switching

### Error Cases (3-error-handling.md)
Edge case testing:
- Invalid syntax
- Missing tags
- Malformed tasks

## Running Tests
1. Create a test vault
2. Install plugin
3. Copy these files to test vault
4. Follow TEST_PLAN.md procedures
5. Run through files in order

## File Structure
```
test-data/
├── README.md          # This file
├── 1-basic-tasks.md   # Core functionality
├── 2-settings-test.md # Configuration
└── 3-error-handling.md # Error cases
```

## Adding Tests
1. Follow numerical naming (e.g., 4-new-feature.md)
2. Document purpose in this README
3. Add test cases to TEST_PLAN.md
4. Maintain consistent format