const mock = require('mock-fs');
const {
  parseArgs,
  processFile,
  resolveConfig,
  shouldProcessFile,
  check,
  convert,
  SENSIBLE_DEFAULTS,
} = require('./index.cjs');
const fs = require('fs');
const { resolve } = require('path');

function baseMock(overrides = {}) {
  return {
    'src/file1.txt': 'hello\r\nworld\r\n',
    'src/file2.js': 'console.log("test");\r\n',
    'src/subdir/file3.txt': 'test\r\n',
    'test/file1.txt': 'hello\r\nworld\r\n',
    'test/file2.js': 'console.log("test");\r\n',
    'test/subdir/file3.txt': 'test\r\n',
    'node_modules/file.js': 'console.log("test");\r\n',
    'node_modules/subdir/file4.txt': 'test\r\n',
    'index.js': 'console.log("test");\r\n',
    ...overrides,
  };
}

describe('CRLF to LF Converter', () => {
  let originalArgv;

  beforeEach(() => {
    mock(baseMock());
    originalArgv = process.argv;
  });

  afterEach(() => {
    mock.restore();
    process.argv = originalArgv;
  });

  describe('parseArgs', () => {
    it('should return config path when --config option is provided', () => {
      process.argv = [
        'node',
        'lfify',
        '--config',
        './path/for/test/.lfifyrc.json',
      ];

      const options = parseArgs();

      expect(options.configPath).toBe('./path/for/test/.lfifyrc.json');
    });

    it('should return default config path when --config option is not provided', () => {
      process.argv = ['node', 'lfify'];

      const options = parseArgs();

      expect(options.configPath).toBe('.lfifyrc.json');
    });

    it('should return include patterns when single --include option is provided', () => {
      process.argv = ['node', 'lfify', '--include', '**/*.js'];
      const options = parseArgs();
      expect(options.include).toEqual(['**/*.js']);
    });

    it('should return multiple include patterns when multiple --include options are provided', () => {
      process.argv = [
        'node',
        'lfify',
        '--include',
        '**/*.js',
        '--include',
        '**/*.ts',
      ];
      const options = parseArgs();
      expect(options.include).toEqual(['**/*.js', '**/*.ts']);
    });

    it('should return exclude patterns when --exclude option is provided', () => {
      process.argv = ['node', 'lfify', '--exclude', 'node_modules/**'];
      const options = parseArgs();
      expect(options.exclude).toEqual(['node_modules/**']);
    });

    it('should return multiple exclude patterns when multiple --exclude options are provided', () => {
      process.argv = [
        'node',
        'lfify',
        '--exclude',
        'dist/**',
        '--exclude',
        'coverage/**',
      ];
      const options = parseArgs();
      expect(options.exclude).toEqual(['dist/**', 'coverage/**']);
    });

    it('should return entry path when --entry option is provided', () => {
      process.argv = ['node', 'lfify', '--entry', './src'];
      const options = parseArgs();
      expect(options.entry).toContain('src');
    });

    it('should handle all options together', () => {
      process.argv = [
        'node',
        'lfify',
        '--config',
        'custom.json',
        '--include',
        '*.js',
        '--exclude',
        'dist/**',
        '--entry',
        './lib',
        '--log-level',
        'info',
      ];
      const options = parseArgs();
      expect(options.configPath).toBe('custom.json');
      expect(options.include).toEqual(['*.js']);
      expect(options.exclude).toEqual(['dist/**']);
      expect(options.entry).toContain('lib');
      expect(options.logLevel).toBe('info');
    });

    it('should return undefined for include/exclude/entry when not provided', () => {
      process.argv = ['node', 'lfify'];
      const options = parseArgs();
      expect(options.include).toBeUndefined();
      expect(options.exclude).toBeUndefined();
      expect(options.entry).toBeUndefined();
    });

    it('should use positional argument as entry when no flags are provided', () => {
      process.argv = ['node', 'lfify', './src'];
      const options = parseArgs();
      expect(options.entry).toBe('./src');
    });

    it('should prefer --entry over positional argument when both are provided', () => {
      process.argv = ['node', 'lfify', '--entry', './lib', './src'];
      const options = parseArgs();
      expect(options.entry).toBe('./lib');
    });

    it('should return logLevel when --log-level option is provided', () => {
      process.argv = ['node', 'lfify', '--log-level', 'warn'];
      const options = parseArgs();
      expect(options.logLevel).toBe('warn');
    });

    it('should accept error, warn, info for --log-level', () => {
      for (const level of ['error', 'warn', 'info']) {
        process.argv = ['node', 'lfify', '--log-level', level];
        expect(parseArgs().logLevel).toBe(level);
      }
    });

    it('should enable check mode when --check is provided', () => {
      process.argv = ['node', 'lfify', '--check'];

      expect(parseArgs().check).toBe(true);
    });
  });

  describe('shouldProcessFile', () => {
    it('should return true when file matches include pattern and does not match exclude pattern', () => {
      const config = { include: ['**/*.js'], exclude: ['node_modules/**'] };
      expect(shouldProcessFile('src/app.js', config)).toBe(true);
    });

    it('should return false when file matches exclude pattern', () => {
      const config = { include: ['**/*.js'], exclude: ['node_modules/**'] };
      expect(shouldProcessFile('node_modules/pkg/index.js', config)).toBe(
        false,
      );
    });

    it('should return false when file does not match include pattern', () => {
      const config = { include: ['**/*.js'], exclude: ['node_modules/**'] };
      expect(shouldProcessFile('src/readme.txt', config)).toBe(false);
    });

    it('should handle multiple include patterns', () => {
      const config = {
        include: ['**/*.js', '**/*.ts'],
        exclude: ['node_modules/**'],
      };
      expect(shouldProcessFile('src/app.js', config)).toBe(true);
      expect(shouldProcessFile('src/app.ts', config)).toBe(true);
    });

    it('should handle multiple exclude patterns', () => {
      const config = {
        include: ['**/*.js'],
        exclude: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
      };
      expect(shouldProcessFile('src/file.js', config)).toBe(true);
      expect(shouldProcessFile('node_modules/pkg/file.js', config)).toBe(false);
      expect(shouldProcessFile('dist/bundle.js', config)).toBe(false);
      expect(shouldProcessFile('test/unit.js', config)).toBe(true);
    });
  });

  describe('processFile', () => {
    it('should convert CRLF to LF when file is processed', async () => {
      const shouldbe = 'hello\nworld\n';

      await processFile('./src/file1.txt');
      const content = await fs.promises.readFile('./src/file1.txt', 'utf8');

      expect(content).toBe(shouldbe);
    });

    it('should not modify file when no CRLF exists', async () => {
      mock(baseMock({ 'src/clean.txt': 'hello\nworld\n' }));

      await processFile('./src/clean.txt');
      const content = await fs.promises.readFile('./src/clean.txt', 'utf8');

      expect(content).toBe('hello\nworld\n');
    });
  });

  describe('convert', () => {
    it('should convert only the given file when entry is a file, even if exclude patterns would match it', async () => {
      const config = {
        entry: resolve('src/file1.txt'),
        include: ['**/*.js'],
        exclude: ['**/*.txt'],
      };

      await convert(config.entry, config);

      const converted = await fs.promises.readFile('src/file1.txt', 'utf8');
      expect(converted).toBe('hello\nworld\n');
    });

    it('should not touch other files when entry is a single file', async () => {
      const config = {
        entry: resolve('src/file1.txt'),
        include: ['**/*'],
        exclude: [],
      };

      await convert(config.entry, config);

      const untouched = await fs.promises.readFile('src/file2.js', 'utf8');
      expect(untouched).toBe('console.log("test");\r\n');
    });

    it('should traverse directory when entry is a directory', async () => {
      const config = {
        entry: resolve('src'),
        include: ['**/*'],
        exclude: [],
      };

      await convert(config.entry, config);

      const file1 = await fs.promises.readFile('src/file1.txt', 'utf8');
      expect(file1).toBe('hello\nworld\n');
      const subdirFile = await fs.promises.readFile(
        'src/subdir/file3.txt',
        'utf8',
      );
      expect(subdirFile).toBe('test\n');
    });

    it('should reject when entry path does not exist', async () => {
      const config = {
        entry: resolve('nonexistent-path'),
        include: ['**/*'],
        exclude: [],
      };

      await expect(convert(config.entry, config)).rejects.toThrow();
    });
  });

  describe('check', () => {
    it('should report CRLF files without modifying them', async () => {
      const config = {
        entry: resolve('src'),
        include: ['**/*'],
        exclude: [],
      };

      await expect(check(config.entry, config)).resolves.toEqual([
        resolve('src/file1.txt'),
        resolve('src/file2.js'),
        resolve('src/subdir/file3.txt'),
      ]);

      const content = await fs.promises.readFile('src/file1.txt', 'utf8');
      expect(content).toBe('hello\r\nworld\r\n');
    });

    it('should respect include and exclude patterns for directory entries', async () => {
      const config = {
        entry: resolve('.'),
        include: ['**/*.js'],
        exclude: ['node_modules/**', 'test/**'],
      };

      await expect(check(config.entry, config)).resolves.toEqual([
        resolve('index.js'),
        resolve('src/file2.js'),
      ]);
    });

    it('should check a file entry even when patterns exclude it', async () => {
      const config = {
        entry: resolve('src/file1.txt'),
        include: ['**/*.js'],
        exclude: ['**/*.txt'],
      };

      await expect(check(config.entry, config)).resolves.toEqual([
        resolve('src/file1.txt'),
      ]);
    });
  });

  describe('resolveConfig', () => {
    it('should use CLI options when provided without config file', async () => {
      const options = {
        include: ['**/*.js'],
        exclude: ['node_modules/**'],
        entry: './src',
      };
      const config = await resolveConfig(options);

      expect(config.include).toEqual(['**/*.js']);
      expect(config.exclude).toEqual(['node_modules/**']);
      expect(config.entry).toContain('src');
    });

    it('should use sensible defaults when no config file and no CLI options', async () => {
      const config = await resolveConfig({});

      expect(config.include).toEqual(SENSIBLE_DEFAULTS.include);
      expect(config.exclude).toEqual(SENSIBLE_DEFAULTS.exclude);
    });

    it('should override config file values with CLI options', async () => {
      mock(
        baseMock({
          '.lfifyrc.json': JSON.stringify({
            entry: './',
            include: ['**/*.md'],
            exclude: ['dist/**'],
          }),
        }),
      );

      const options = {
        configPath: '.lfifyrc.json',
        include: ['**/*.js'],
      };
      const config = await resolveConfig(options);

      expect(config.include).toEqual(['**/*.js']);
      expect(config.exclude).toEqual(['dist/**']);
    });

    it('should load config file when configPath is provided and file exists', async () => {
      mock(
        baseMock({
          '.lfifyrc.json': JSON.stringify({
            entry: './lib',
            include: ['**/*.ts'],
            exclude: ['test/**'],
          }),
        }),
      );

      const options = { configPath: '.lfifyrc.json' };
      const config = await resolveConfig(options);

      expect(config.include).toEqual(['**/*.ts']);
      expect(config.exclude).toEqual(['test/**']);
    });

    it('should use defaults when config file not found and no CLI options', async () => {
      const options = { configPath: 'nonexistent.json' };
      const config = await resolveConfig(options);

      expect(config.include).toEqual(SENSIBLE_DEFAULTS.include);
      expect(config.exclude).toEqual(SENSIBLE_DEFAULTS.exclude);
    });

    it('should throw when config file contains invalid JSON', async () => {
      mock(baseMock({ '.lfifyrc.json': 'invalid json' }));
      const options = { configPath: '.lfifyrc.json' };
      await expect(resolveConfig(options)).rejects.toThrow();
    });

    it('should use CLI include with default exclude when only include provided', async () => {
      const options = { include: ['**/*.js'] };
      const config = await resolveConfig(options);

      expect(config.include).toEqual(['**/*.js']);
      expect(config.exclude).toEqual(SENSIBLE_DEFAULTS.exclude);
    });

    it('should use CLI exclude with default include when only exclude provided', async () => {
      const options = { exclude: ['custom/**'] };
      const config = await resolveConfig(options);

      expect(config.include).toEqual(SENSIBLE_DEFAULTS.include);
      expect(config.exclude).toEqual(['custom/**']);
    });

    it('should include logLevel in config, defaulting to error', async () => {
      const config = await resolveConfig({});
      expect(config.logLevel).toBe('error');
    });

    it('should use logLevel from config file when provided', async () => {
      mock(
        baseMock({
          '.lfifyrc.json': JSON.stringify({
            entry: './',
            include: ['**/*.js'],
            exclude: ['node_modules/**'],
            logLevel: 'info',
          }),
        }),
      );
      const config = await resolveConfig({ configPath: '.lfifyrc.json' });
      expect(config.logLevel).toBe('info');
    });

    it('should override config file logLevel with CLI --log-level', async () => {
      mock(
        baseMock({
          '.lfifyrc.json': JSON.stringify({
            entry: './',
            include: ['**/*.js'],
            exclude: ['node_modules/**'],
            logLevel: 'warn',
          }),
        }),
      );
      const config = await resolveConfig({
        configPath: '.lfifyrc.json',
        logLevel: 'info',
      });
      expect(config.logLevel).toBe('info');
    });
  });
});
