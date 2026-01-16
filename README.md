# LFify

A lightweight Node.js program to convert CRLF to LF line endings.  
It is useful when your development environment is Windows.

## Getting started

create .lfifyrc.json

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

and then

```bash
npx lfify
```

you can add options below.

## Options

| Option            | Description                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `--config <path>` | Specify a custom path for the configuration file. Default is `.lfifyrc.json` in the current directory. |

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
