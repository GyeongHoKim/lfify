const mock = require('mock-fs');
const {
  readConfig,
  parseArgs,
  processFile,
  resolveConfig,
  shouldProcessFile,
  SENSIBLE_DEFAULTS,
} = require('./index.cjs');
const fs = require('fs');

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

  describe('readConfig', () => {
    it('should return config when valid config file is provided', async () => {
      const validConfig = {
        entry: './',
        include: ['*.js'],
        exclude: ['node_modules/**'],
      };
      mock(baseMock({ '.lfifyrc.json': JSON.stringify(validConfig) }));

      const config = await readConfig('.lfifyrc.json');

      expect(config).toEqual(
        expect.objectContaining({
          entry: expect.any(String),
          include: expect.any(Array),
          exclude: expect.any(Array),
        }),
      );
    });

    it('should throw error when config file is not found', async () => {
      await expect(readConfig('.lfifyrc.json')).rejects.toThrow();
    });

    it('should throw error when config file is invalid json', async () => {
      mock(baseMock({ '.lfifyrc.json': 'invalid json' }));

      await expect(readConfig('.lfifyrc.json')).rejects.toThrow();
    });
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
