#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const micromatch = require("micromatch");

/** @type {ReadonlyArray<string>} */
const LOG_LEVELS = ['error', 'warn', 'info'];

/**
 * @typedef {Object} Config
 * @property {string} entry - 처리할 시작 디렉토리 경로
 * @property {string[]} include - 포함할 파일 패턴 목록
 * @property {string[]} exclude - 제외할 파일 패턴 목록
 * @property {'error'|'warn'|'info'} [logLevel] - 로그 레벨 (error: 에러만, warn: 에러+경고, info: 전체)
 */

/**
 * @typedef {Object} Logger
 * @property {function(string): void} setLogLevel - 로그 레벨 설정 ('error'|'warn'|'info')
 * @property {function(string, string): void} warn - 경고 메시지 출력
 * @property {function(string, string, Error=): void} error - 에러 메시지 출력
 * @property {function(string, string): void} info - 정보 메시지 출력
 */

/**
 * @typedef {Object} CommandOptions
 * @property {string} [configPath] - 설정 파일 경로
 * @property {string} [entry] - CLI로 지정한 entry 경로
 * @property {string[]} [include] - CLI로 지정한 include 패턴
 * @property {string[]} [exclude] - CLI로 지정한 exclude 패턴
 * @property {'error'|'warn'|'info'} [logLevel] - CLI로 지정한 로그 레벨
 */

/**
 * Default configuration
 * @type {Config}
 */
const DEFAULT_CONFIG = {
  entry: './',
  include: [],
  exclude: [],
  logLevel: 'error'
};

/**
 * Sensible defaults when no config file is provided
 * @type {Config}
 */
const SENSIBLE_DEFAULTS = {
  entry: './',
  include: ['**/*'],
  exclude: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    'coverage/**'
  ],
  logLevel: 'error'
};

/**
 * Configuration validation schema
 * @type {Object.<string, function(*): boolean>}
 */
const CONFIG_SCHEMA = {
  entry: (value) => typeof value === 'string',
  include: (value) => Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string'),
  exclude: (value) => Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string'),
  logLevel: (value) => LOG_LEVELS.includes(value),
};

/**
 * Logging utility. 기본은 error만 출력. setLogLevel로 변경 가능.
 * @type {Logger & { _level: string, setLogLevel: function(string): void }}
 */
const logger = {
  _level: 'error',

  setLogLevel(level) {
    if (LOG_LEVELS.includes(level)) {
      this._level = level;
    }
  },

  error(msg, path, err) {
    if (err !== undefined) {
      console.error(`${msg} ${path}`, err);
    } else {
      console.error(`${msg} ${path}`);
    }
  },

  warn(msg, path) {
    if (LOG_LEVELS.indexOf(this._level) >= LOG_LEVELS.indexOf('warn')) {
      console.warn(`${msg} ${path}`);
    }
  },

  info(msg, path) {
    if (LOG_LEVELS.indexOf(this._level) >= LOG_LEVELS.indexOf('info')) {
      console.log(`${msg} ${path}`);
    }
  },
};

/**
 * Read and validate configuration file
 * @param {string} configPath - path to configuration file
 * @returns {Promise<Config>} - validated configuration
 * @throws {Error} - if configuration is invalid or file is not found
 */
async function readConfig(configPath) {
  try {
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);

    // Validate required fields
    for (const [key, validator] of Object.entries(CONFIG_SCHEMA)) {
      if (config[key] && !validator(config[key])) {
        throw new Error(`Invalid "${key}" in configuration file`);
      }
    }

    return {
      ...DEFAULT_CONFIG,
      ...config,
      entry: path.resolve(process.cwd(), config.entry || DEFAULT_CONFIG.entry)
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.error(`Configuration file not found: ${configPath}`, configPath);
    } else {
      logger.error(`Error reading configuration file: ${err.message}`, configPath);
    }
    
    if (require.main === module) {
      process.exit(1);
    }
    throw err;
  }
}

/**
 * Resolve final configuration from CLI options, config file, and defaults
 * @param {CommandOptions} cliOptions - parsed CLI options
 * @returns {Promise<Config>} - resolved configuration
 */
async function resolveConfig(cliOptions) {
  let fileConfig = null;

  // Try to load config file if it exists
  if (cliOptions.configPath) {
    try {
      const configContent = await fs.readFile(cliOptions.configPath, 'utf8');
      fileConfig = JSON.parse(configContent);

      // Validate config file fields
      for (const [key, validator] of Object.entries(CONFIG_SCHEMA)) {
        if (fileConfig[key] && !validator(fileConfig[key])) {
          throw new Error(`Invalid "${key}" in configuration file`);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Re-throw parsing/validation errors
        logger.error(`Error reading configuration file: ${err.message}`, cliOptions.configPath);
        throw err;
      }
      // ENOENT is okay - config file is optional now
    }
  }

  // Determine final values with precedence: CLI > config file > defaults
  const hasCLIInclude = Array.isArray(cliOptions.include) && cliOptions.include.length > 0;
  const hasCLIExclude = Array.isArray(cliOptions.exclude) && cliOptions.exclude.length > 0;
  const hasCLIEntry = typeof cliOptions.entry === 'string';
  const hasCLILogLevel = typeof cliOptions.logLevel === 'string' && LOG_LEVELS.includes(cliOptions.logLevel);

  const hasFileConfig = fileConfig !== null;
  const hasFileInclude = hasFileConfig && Array.isArray(fileConfig.include) && fileConfig.include.length > 0;
  const hasFileExclude = hasFileConfig && Array.isArray(fileConfig.exclude) && fileConfig.exclude.length > 0;
  const hasFileEntry = hasFileConfig && typeof fileConfig.entry === 'string';
  const hasFileLogLevel = hasFileConfig && fileConfig.logLevel && LOG_LEVELS.includes(fileConfig.logLevel);

  // Resolve each config property
  let include, exclude, entry, logLevel;

  // Include: CLI > file > default
  if (hasCLIInclude) {
    include = cliOptions.include;
  } else if (hasFileInclude) {
    include = fileConfig.include;
  } else {
    include = SENSIBLE_DEFAULTS.include;
  }

  // Exclude: CLI > file > default
  if (hasCLIExclude) {
    exclude = cliOptions.exclude;
  } else if (hasFileExclude) {
    exclude = fileConfig.exclude;
  } else {
    exclude = SENSIBLE_DEFAULTS.exclude;
  }

  // Entry: CLI > file > default
  if (hasCLIEntry) {
    entry = cliOptions.entry;
  } else if (hasFileEntry) {
    entry = fileConfig.entry;
  } else {
    entry = SENSIBLE_DEFAULTS.entry;
  }

  // LogLevel: CLI > file > default
  if (hasCLILogLevel) {
    logLevel = cliOptions.logLevel;
  } else if (hasFileLogLevel) {
    logLevel = fileConfig.logLevel;
  } else {
    logLevel = SENSIBLE_DEFAULTS.logLevel;
  }

  return {
    entry: path.resolve(process.cwd(), entry),
    include,
    exclude,
    logLevel
  };
}

/**
 * Parse command line arguments
 * @returns {CommandOptions} - parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    configPath: '.lfifyrc.json'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--config':
        if (nextArg) {
          options.configPath = nextArg;
          i++;
        }
        break;

      case '--entry':
        if (nextArg) {
          options.entry = nextArg;
          i++;
        }
        break;

      case '--include':
        if (nextArg) {
          options.include = options.include || [];
          options.include.push(nextArg);
          i++;
        }
        break;

      case '--exclude':
        if (nextArg) {
          options.exclude = options.exclude || [];
          options.exclude.push(nextArg);
          i++;
        }
        break;

      case '--log-level':
        if (nextArg && LOG_LEVELS.includes(nextArg)) {
          options.logLevel = nextArg;
          i++;
        }
        break;
    }
  }

  return options;
}

/**
 * Check if file should be processed based on include/exclude patterns
 * @param {string} filePath - relative file path
 * @param {Config} config - configuration object
 * @returns {boolean} - true if file should be processed
 */
function shouldProcessFile(filePath, config) {
  const isIncluded = micromatch.isMatch(filePath, config.include);
  const isExcluded = micromatch.isMatch(filePath, config.exclude);

  return isIncluded && !isExcluded;
}

/**
 * traverse a specific directory recursively and convert all files' CRLF to LF
 * @param {string} dirPath - directory path to search
 * @param {Config} config - configuration object
 * @returns {Promise<void>}
 * @throws {Error} - if there's an error reading directory or processing files
 */
async function convertCRLFtoLF(dirPath, config) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    /**
     * @todo Node.js is single-threaded, if I want to convert files in parallel, I need to use worker_threads
     */
    await Promise.all(entries.map(async entry => {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        await convertCRLFtoLF(fullPath, config);
      } else if (entry.isFile() && shouldProcessFile(relativePath, config)) {
        await processFile(fullPath);
      } else {
        logger.info(`skipped: ${relativePath}`, fullPath);
      }
    }));
  } catch (err) {
    logger.error(`error reading directory: ${dirPath}`, dirPath, err);
    throw err;
  }
}

/**
 * convert CRLF to LF
 * @param {string} filePath - full path of the file to process
 * @returns {Promise<void>}
 * @throws {Error} - if there's an error reading or writing file
 */
async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const updatedContent = content.replace(/\r\n/g, "\n");

    if (content !== updatedContent) {
      /**
       * @todo V8 javascript engine with 32-bit system cannot handle more than 2GB file,
       * so I should use createReadStream and createWriteStream to handle large files
       */
      await fs.writeFile(filePath, updatedContent, "utf8");
      logger.info(`converted: ${filePath}`);
    } else {
      logger.info(`no need to convert: ${filePath}`, filePath);
    }
  } catch (err) {
    logger.error(`error processing file: ${filePath}`, filePath, err);
    throw err;
  }
}

async function main() {
  const options = parseArgs();
  const config = await resolveConfig(options);

  logger.setLogLevel(config.logLevel);

  logger.info(`converting CRLF to LF in: ${config.entry}`, config.entry);

  await convertCRLFtoLF(config.entry, config);

  logger.info("conversion completed.", config.entry);
}

if (require.main === module) {
  main();
}

module.exports = {
  convertCRLFtoLF,
  processFile,
  readConfig,
  parseArgs,
  resolveConfig,
  shouldProcessFile,
  SENSIBLE_DEFAULTS,
};
