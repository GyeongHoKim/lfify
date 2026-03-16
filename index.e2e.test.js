const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { resolveConfig, convertCRLFtoLF, collectFiles, processFilesWithPool } = require('./index.cjs');

const FIXTURES_DIR = path.join(__dirname, '__fixtures__');
const CRLF = Buffer.from([0x0d, 0x0a]);

/**
 * Recursively copy a directory from src to dest.
 * @param {string} src - source directory
 * @param {string} dest - destination directory
 */
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

describe('E2E: CRLF to LF with real filesystem', () => {
  let tempDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lfify-e2e-'));
  });

  afterEach(async () => {
    try {
      process.chdir(originalCwd);
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch {
      // best-effort cleanup
    }
  });

  describe('US1: default run (no config)', () => {
    it('converts files under entry and excludes node_modules and .git', async () => {
      await copyDir(path.join(FIXTURES_DIR, 'default-sensible'), tempDir);
      await fs.rename(path.join(tempDir, '_git'), path.join(tempDir, '.git'));
      await fs.rename(path.join(tempDir, '_node_modules'), path.join(tempDir, 'node_modules'));
      process.chdir(tempDir);

      const config = await resolveConfig({});
      await convertCRLFtoLF(config.entry, config);

      const appJs = await fs.readFile(path.join(tempDir, 'src', 'app.js'));
      expect(appJs.includes(CRLF)).toBe(false);
      expect(appJs.equals(Buffer.from('console.log("app");\n', 'utf8'))).toBe(true);

      const readmeTxt = await fs.readFile(path.join(tempDir, 'src', 'readme.txt'));
      expect(readmeTxt.includes(CRLF)).toBe(false);
      expect(readmeTxt.equals(Buffer.from('hello\nworld\n', 'utf8'))).toBe(true);

      const nodeModulesPkg = await fs.readFile(
        path.join(tempDir, 'node_modules', 'pkg', 'index.js')
      );
      expect(nodeModulesPkg.includes(CRLF)).toBe(true);

      const gitConfig = await fs.readFile(path.join(tempDir, '.git', 'config'));
      expect(gitConfig.includes(CRLF)).toBe(true);
    });
  });

  describe('US2: .lfifyrc.json', () => {
    it('applies config include/exclude so only matching files are converted', async () => {
      await copyDir(path.join(FIXTURES_DIR, 'with-config'), tempDir);
      process.chdir(tempDir);

      const config = await resolveConfig({ configPath: '.lfifyrc.json' });
      await convertCRLFtoLF(config.entry, config);

      const mainJs = await fs.readFile(path.join(tempDir, 'lib', 'main.js'));
      expect(mainJs.includes(CRLF)).toBe(false);
      expect(mainJs.equals(Buffer.from('const x = 1;\n', 'utf8'))).toBe(true);

      const skipOtherJs = await fs.readFile(path.join(tempDir, 'skip', 'other.js'));
      expect(skipOtherJs.includes(CRLF)).toBe(true);

      const docTxt = await fs.readFile(path.join(tempDir, 'doc.txt'));
      expect(docTxt.includes(CRLF)).toBe(true);
    });
  });

  describe('US3: CLI overrides config', () => {
    it('CLI include overrides config so only .js files are converted', async () => {
      await copyDir(path.join(FIXTURES_DIR, 'cli-override'), tempDir);
      process.chdir(tempDir);

      const config = await resolveConfig({
        configPath: '.lfifyrc.json',
        include: ['**/*.js']
      });
      await convertCRLFtoLF(config.entry, config);

      const aJs = await fs.readFile(path.join(tempDir, 'src', 'a.js'));
      expect(aJs.includes(CRLF)).toBe(false);
      expect(aJs.equals(Buffer.from('const a = 1;\n', 'utf8'))).toBe(true);

      const bTxt = await fs.readFile(path.join(tempDir, 'src', 'b.txt'));
      expect(bTxt.includes(CRLF)).toBe(true);
    });
  });

  describe('US4: already LF', () => {
    it('does not modify files that already use LF', async () => {
      await copyDir(path.join(FIXTURES_DIR, 'already-lf'), tempDir);
      process.chdir(tempDir);

      const config = await resolveConfig({});
      await convertCRLFtoLF(config.entry, config);

      const fileJs = await fs.readFile(path.join(tempDir, 'src', 'file.js'));
      expect(fileJs.includes(CRLF)).toBe(false);
      expect(fileJs.equals(Buffer.from('const x = 1;\n', 'utf8'))).toBe(true);
    });
  });

  describe('US5: workers: true in config file', () => {
    it('converts files correctly using worker pool', async () => {
      await copyDir(path.join(FIXTURES_DIR, 'default-sensible'), tempDir);
      await fs.rename(path.join(tempDir, '_git'), path.join(tempDir, '.git'));
      await fs.rename(path.join(tempDir, '_node_modules'), path.join(tempDir, 'node_modules'));
      await fs.writeFile(path.join(tempDir, '.lfifyrc.json'), JSON.stringify({
        entry: './', include: ['**/*'], exclude: ['node_modules/**', '.git/**'], workers: true
      }));
      process.chdir(tempDir);

      const config = await resolveConfig({ configPath: path.join(tempDir, '.lfifyrc.json') });
      expect(config.workers).toBe(true);

      const filePaths = await collectFiles(config.entry, config);
      await processFilesWithPool(filePaths);

      const appJs = await fs.readFile(path.join(tempDir, 'src', 'app.js'));
      expect(appJs.includes(CRLF)).toBe(false);
      expect(appJs.equals(Buffer.from('console.log("app");\n', 'utf8'))).toBe(true);
      expect((await fs.readFile(path.join(tempDir, 'node_modules', 'pkg', 'index.js'))).includes(CRLF)).toBe(true);
    });
  });

  describe('US6: --workers CLI flag', () => {
    it('converts files when workers is set via CLI-equivalent resolveConfig', async () => {
      await copyDir(path.join(FIXTURES_DIR, 'default-sensible'), tempDir);
      await fs.rename(path.join(tempDir, '_git'), path.join(tempDir, '.git'));
      await fs.rename(path.join(tempDir, '_node_modules'), path.join(tempDir, 'node_modules'));
      process.chdir(tempDir);

      const config = await resolveConfig({ workers: true });
      expect(config.workers).toBe(true);

      const filePaths = await collectFiles(config.entry, config);
      await processFilesWithPool(filePaths);

      const appJs = await fs.readFile(path.join(tempDir, 'src', 'app.js'));
      expect(appJs.includes(CRLF)).toBe(false);
      expect((await fs.readFile(path.join(tempDir, 'node_modules', 'pkg', 'index.js'))).includes(CRLF)).toBe(true);
    });
  });
});
