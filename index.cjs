#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const micromatch = require("micromatch");

/**
 * @typedef {Object} Config
 * @property {string} entry - 처리할 시작 디렉토리 경로
 * @property {string[]} include - 포함할 파일 패턴 목록
 * @property {string[]} exclude - 제외할 파일 패턴 목록
 */

/**
 * @typedef {Object} Logger
 * @property {function(string, string): void} warn - 경고 메시지 출력
 * @property {function(string, string, Error=): void} error - 에러 메시지 출력
 * @property {function(string, string): void} info - 정보 메시지 출력
 */

/**
 * @typedef {Object} CommandOptions
 * @property {string} configPath - 설정 파일 경로
 */

/**
 * Default configuration
 * @type {Config}
 */
const DEFAULT_CONFIG = {
  entry: './',
  include: [],
  exclude: []
};

/**
 * Configuration validation schema
 * @type {Object.<string, function(*): boolean>}
 */
const CONFIG_SCHEMA = {
  entry: (value) => typeof value === 'string',
  include: (value) => Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string'),
  exclude: (value) => Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string'),
};

/**
 * Logging utility
 * @type {Logger}
 */
const logger = {
  warn: (msg, path) => console.warn(`${msg} ${path}`),
  error: (msg, path, err) => console.error(`${msg} ${path}`, err),
  info: (msg, path) => console.log(`${msg} ${path}`),
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
      if (!config[key]) {
        throw new Error(`Invalid or missing "${key}" in configuration file`);
      }
      if (!validator(config[key])) {
        throw new Error(`Invalid "${key}" in configuration file`);
      }
    }

    return {
      ...DEFAULT_CONFIG,
      ...config,
      entry: path.resolve(process.cwd(), config.entry)
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.error(`Configuration file not found: ${configPath}`, configPath);
    } else {
      logger.error(`Error reading configuration file: ${err.message}`, configPath);
    }
    process.exit(1);
  }
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
    if (args[i] === '--config' && args[i + 1]) {
      options.configPath = args[i + 1];
      i++;
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

(async () => {
  const options = parseArgs();
  const config = await readConfig(options.configPath);

  logger.info(`converting CRLF to LF in: ${config.entry}`, config.entry);

  await convertCRLFtoLF(config.entry, config);

  logger.info("conversion completed.", config.entry);
})();

module.exports = {
  convertCRLFtoLF,
  processFile,
  readConfig,
  parseArgs,
};
