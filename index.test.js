const fs = require('fs').promises;
const path = require('path');

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
  },
}));

const { getIgnoreInstance, convertCRLFtoLF, processFile } = require('./index.cjs');

describe('CRLF to LF Converter', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getIgnoreInstance', () => {
    it('should create ignore instance with gitignore content', async () => {
      fs.readFile.mockResolvedValue('node_modules\n.git\n*.log');
      
      const ig = await getIgnoreInstance('/test/path');
      
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('/test/path', '.gitignore'),
        'utf8'
      );
      expect(ig.ignores('node_modules')).toBe(true);
      expect(ig.ignores('test.log')).toBe(true);
      expect(ig.ignores('src/index.js')).toBe(false);
    });

    it('should handle missing gitignore file', async () => {
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);
      
      const consoleSpy = jest.spyOn(console, 'warn');
      
      const ig = await getIgnoreInstance('/test/path');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '.gitignore file not found. processing all files. /test/path/.gitignore'
      );
      expect(ig.ignores('node_modules')).toBe(false);
    });
  });

  describe('processFile', () => {
    it('should convert CRLF to LF in text files', async () => {
      const testContent = 'line1\r\nline2\r\nline3';
      const expectedContent = 'line1\nline2\nline3';
      
      fs.readFile.mockResolvedValue(testContent);
      
      await processFile('test.js');
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        'test.js',
        expectedContent,
        'utf8'
      );
    });

    it('should skip files with unsupported extensions', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await processFile('test.exe');
      
      expect(fs.readFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('skipped (extension)')
      );
    });

    it('should handle files that dont need conversion', async () => {
      const content = 'line1\nline2\nline3';
      fs.readFile.mockResolvedValue(content);
      
      const consoleSpy = jest.spyOn(console, 'log');
      
      await processFile('test.js');
      
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('no need to convert')
      );
    });
  });

  describe('convertCRLFtoLF', () => {
    const createDirent = (name, isDir) => ({
      name,
      isDirectory: () => isDir,
      isFile: () => !isDir,
    });

    it('should process all files in directory recursively', async () => {
      const mockEntries = [
        createDirent('test.js', false),
        createDirent('test.md', false),
        createDirent('subfolder', true),
      ];

      fs.readdir.mockResolvedValueOnce(mockEntries);
      fs.readdir.mockResolvedValueOnce([
        createDirent('test.js', false)
      ]);

      fs.readFile.mockResolvedValue('test\r\ndata');
      
      const ig = { ignores: jest.fn().mockReturnValue(false) };
      
      await convertCRLFtoLF('/test/path', ig);
      
      expect(fs.readdir).toHaveBeenCalledTimes(2);
      expect(fs.readFile).toHaveBeenCalledTimes(3);
    });

    it('should skip ignored files and directories', async () => {
      const mockEntries = [
        createDirent('.git', true),
        createDirent('node_modules', true),
        createDirent('test.log', false),
      ];

      fs.readdir.mockResolvedValue(mockEntries);
      
      const ig = { ignores: jest.fn().mockReturnValue(true) };
      const consoleSpy = jest.spyOn(console, 'log');
      
      await convertCRLFtoLF('/test/path', ig);
      
      expect(fs.readFile).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('excluded')
      );
    });
  });
});
