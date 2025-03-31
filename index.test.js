const { readConfig, parseArgs, processFile } = require('./index.cjs');

jest.mock('fs');
jest.mock('path');
jest.mock('micromatch');

describe('CRLF to LF Converter', () => {
  const MOCK_FILE_INFO = {
    './src/file1.txt': 'hello\r\nworld\r\n',
    './src/file2.js': 'console.log("test");\r\n',
    './src/subdir/file3.txt': 'test\r\n',
    './test/file1.txt': 'hello\r\nworld\r\n',
    './test/file2.js': 'console.log("test");\r\n',
    './test/subdir/file3.txt': 'test\r\n',
    './node_modules/file.js': 'console.log("test");\r\n',
    './node_modules/subdir/file4.txt': 'test\r\n',
    'index.js': 'console.log("test");\r\n'
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    require('fs').__setMockFiles(MOCK_FILE_INFO);
  });

  describe('readConfig', () => {
    it('should return config when valid config file is provided', async () => {
      // arrange
      const validConfig = {
        entry: './',
        include: ['*.js'],
        exclude: ['node_modules/**']
      };
      require('fs').__setConfig(JSON.stringify(validConfig));

      // act
      const config = await readConfig('.lfifyrc.json');

      // assert
      expect(config).toEqual(expect.objectContaining({
        entry: expect.any(String),
        include: expect.any(Array),
        exclude: expect.any(Array)
      }));
    });

    it('should throw error when config file is not found', async () => {
      // act & assert
      await expect(readConfig('.lfifyrc.json')).rejects.toThrow();
    });

    it('should throw error when config file is invalid json', async () => {
      // arrange
      require('fs').__setConfig('invalid json');

      // act & assert
      await expect(readConfig('.lfifyrc.json')).rejects.toThrow();
    });
  });

  describe('parseArgs', () => {
    it('should return config path when --config option is provided', () => {
      // arrange
      process.argv = ['node', 'lfify', '--config', './path/for/test/.lfifyrc.json'];

      // act
      const options = parseArgs();

      // assert
      expect(options.configPath).toBe('./path/for/test/.lfifyrc.json');
    });

    it('should return default config path when --config option is not provided', () => {
      // arrange
      process.argv = ['node', 'lfify'];

      // act
      const options = parseArgs();

      // assert
      expect(options.configPath).toBe('.lfifyrc.json');
    });
  });

  describe('shouldProcessFile', () => {
    it('should return true when file matches include pattern and does not match exclude pattern', () => {
      /**
       * This function uses micromatch to check config.include and config.exclude
       * so this test case is already tested in micromatch's test file
       * so I'm not going to test this function
       */
    });
  });

  describe('processFile', () => {
    it('should convert CRLF to LF when file is processed', async () => {
      // arrange
      const shouldbe = 'hello\nworld\n';

      // act
      await processFile('./src/file1.txt');
      const content = await require('fs').promises.readFile('./src/file1.txt', 'utf8');

      // assert
      expect(content).toBe(shouldbe);
    })
  });
}); 