# LFify

A lightweight Node.js library to convert CRLF to LF line endings.  
It is useful when your development environment is Windows.  

웹 개발자에게 Windows OS PC를 제공하는 우리 회사, 당장 반성하라!! 뭐만 하면 windows-cp-949 인코딩에 CRLF 라인피드 때문에 문제가 생겨요. Node.js 개발자한테 Windows PC 제공, 이거 법적으로 금지해야 해요.

# Features

 - Exclude files from your `.gitignore`
 - Exclude `.git` and `node_modules` directories on default
 - Recursive conversion
 - Supports multiple file extensions(generally used on Web Development)

 # Installation

first, edit your `.npmrc` file.

```bash
@GyeongHoKim:registry=https://npm.pkg.github.com
```

then, install it.

```bash
npm install --save-dev lfify
```

# Usage

## Basic Usage

```bash
npx lfify
```

## Specify Custom Directory

```bash
npx lfify ./path/to/your/project
```

## Script on your `package.json`

```json
"scripts": {
  "lfify": "lfify"
}
```

# Supported File Extensions

- JavaScript: `.js`, `.jsx`, `.cjs`, `.mjs`
- TypeScript: `.ts`, `.tsx`
- Web: `.html`, `.css`, `.scss`, `.vue`
- Markup/Config: `.json`, `.xml`, `.yml`, `.yaml`, `.md`
- Other: `.txt`, `.env`

# Features in Detail

1. Gitignore Support
Automatically reads and respects your .gitignore patterns
Skips ignored files and directories

2. Smart Processing
Only modifies files that actually need conversion
Preserves file encoding
Provides detailed logging of all operations

3. Safe Operation
Automatically excludes binary files
Built-in protection for critical directories
Error handling with detailed logging

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
