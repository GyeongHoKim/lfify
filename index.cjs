const fs = require("fs").promises;
const path = require("path");
const ignore = require("ignore");

/**
 * Constants definition
 * @type {Object}
 */
const CONSTANTS = {
  ALWAYS_EXCLUDED_DIRS: ['.git', 'node_modules'],
  ALLOWED_EXTENSIONS: new Set([
    '.js', '.ts', '.json', '.txt', '.md', '.html', '.css',
    '.jsx', '.tsx', '.xml', '.yml', '.yaml', '.scss',
    '.env', '.vue', '.cjs', '.mjs'
  ])
};

/**
 * Logging utility
 * @type {Object}
 */
const logger = {
  warn: (msg, path) => console.warn(`${msg} ${path}`),
  error: (msg, path, err) => console.error(`${msg} ${path}`, err),
  info: (msg, path) => console.log(`${msg} ${path}`),
};

/**
 * read .gitignore files and set ignore patterns
 * @param {string} dirPath - directory path to search
 * @returns {ignore.Ignore} - ignore instance
 */
async function getIgnoreInstance(dirPath) {
  const ig = ignore();
  const gitignorePath = path.join(dirPath, ".gitignore");
  try {
    const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
    ig.add(gitignoreContent);
  } catch (err) {
    if (err.code === "ENOENT") {
      logger.warn(".gitignore file not found. processing all files.", gitignorePath);
    } else {
      logger.error("error reading .gitignore file", gitignorePath, err);
    }
  }
  return ig;
}

/**
 * Check if file extension is processable
 * @param {string} filePath
 * @returns {boolean}
 */
function isProcessableFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONSTANTS.ALLOWED_EXTENSIONS.has(ext);
}

/**
 * traverse a specific directory recursively and convert all files' CRLF to LF
 * @param {string} dirPath - directory path to search
 * @param {ignore.Ignore} ig - ignore instance
 */
async function convertCRLFtoLF(dirPath, ig) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    if (!entries) {
      logger.error(`error reading directory: ${dirPath}`, dirPath, new Error('no entries'));
      return;
    }

    await Promise.all(entries.map(async entry => {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, "/");

      if (CONSTANTS.ALWAYS_EXCLUDED_DIRS.includes(entry.name)) {
        logger.info(`excluded (directory): ${relativePath}`, fullPath);
        return;
      }

      if (ig.ignores(relativePath)) {
        logger.info(`excluded (pattern matching): ${relativePath}`, fullPath);
        return;
      }

      if (entry.isDirectory()) {
        await convertCRLFtoLF(fullPath, ig);
      } else if (entry.isFile()) {
        await processFile(fullPath);
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
 */
async function processFile(filePath) {
  try {
    if (!isProcessableFile(filePath)) {
      logger.info(`skipped (extension): ${filePath}`, filePath);
      return;
    }

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
  // can receive directory path as a command line argument. default is current directory.
  const targetDir = process.argv[2] || process.cwd();

  logger.info(`converting CRLF to LF in: ${targetDir}`, targetDir);

  // set ignore patterns
  const ig = await getIgnoreInstance(targetDir);

  await convertCRLFtoLF(targetDir, ig);

  logger.info("conversion completed.", targetDir);
})();

module.exports = {
  getIgnoreInstance,
  convertCRLFtoLF,
  processFile,
};
