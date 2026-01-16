# LFify

A lightweight Node.js program to convert CRLF to LF line endings.  
It is useful when your development environment is Windows.

## Getting started

### Using CLI options (no config file needed)

```bash
npx lfify --include "**/*.js" --exclude "node_modules/**"
```

### Using config file

Create `.lfifyrc.json`:

```json
{
  "entry": "./",
  "include": [
    "**/*.{js,ts,jsx,tsx}",
    "**/*.{json,md}",
    "**/*.{css,scss}",
    "**/*.{html,vue}"
  ],
  "exclude": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "coverage/**"
  ]
}
```

Then run:

```bash
npx lfify
```

## Options

| Option               | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `--config <path>`    | Specify a custom path for the configuration file. Default is `.lfifyrc.json`. |
| `--entry <path>`     | Specify the entry directory to process. Default is `./`.                    |
| `--include <pattern>`| Glob pattern(s) to include. Can be used multiple times.                     |
| `--exclude <pattern>`| Glob pattern(s) to exclude. Can be used multiple times.                     |

## Examples

```bash
# Process all JavaScript files, exclude node_modules
npx lfify --include "**/*.js" --exclude "node_modules/**"

# Process multiple file types
npx lfify --include "**/*.js" --include "**/*.ts" --exclude "node_modules/**" --exclude ".git/**"

# Process files in a specific directory
npx lfify --entry ./src --include "**/*.js"

# Use a custom config file
npx lfify --config ./custom-config.json
```

## Default behavior

When no config file is found and no CLI options are provided, lfify uses sensible defaults:
- **include**: `**/*` (all files)
- **exclude**: `node_modules/**`, `.git/**`, `dist/**`, `build/**`, `coverage/**`

## Priority

CLI options take precedence over config file values:
1. CLI arguments (highest)
2. Config file
3. Default values (lowest)

# Development

## Prerequisites

- Node.js 18 or higher
- npm

## Setup

Clone the repository:

```bash
git clone https://github.com/GyeongHoKim/lfify.git
```

Install dependencies:

```bash
npm install
```

# Testing

```bash
npm test
```

# Linting

```bash
npm run lint
```

# Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Run `npm run lint` to check your code
5. Run `npm test` to check your code
6. Submit a pull request

# Issues and Support

If you have any issues or feedback, please open an [issue](https://github.com/GyeongHoKim/lfify/issues) on the GitHub repository.
