const fs = jest.createMockFromModule('fs');

const mockFiles = new Map();

function __setMockFiles(newMockFiles) {
  mockFiles.clear();
  for (const [path, content] of Object.entries(newMockFiles)) {
    mockFiles.set(path, content);
  }
}

function __setConfig(stringifiedConfig, path = '.lfifyrc.json') {
  mockFiles.set(path, stringifiedConfig);
}

const promises = {
  /* eslint-disable-next-line no-unused-vars */
  readFile: jest.fn().mockImplementation((path, ...rest) => {
    if (mockFiles.has(path)) {
      return Promise.resolve(mockFiles.get(path));
    }
    return Promise.reject(new Error(`ENOENT: no such file or directory, open '${path}'`));
  }),

  writeFile: jest.fn().mockImplementation((path, content) => {
    mockFiles.set(path, content);
    return Promise.resolve();
  }),

  /* eslint-disable-next-line no-unused-vars */
  readdir: jest.fn().mockImplementation((path, ...rest) => {
    const entries = [];
    for (const filePath of mockFiles.keys()) {
      if (filePath.startsWith(path)) {
        const relativePath = filePath.slice(path.length + 1);
        const name = relativePath.split('/')[0];
        if (name && !entries.some(e => e.name === name)) {
          entries.push({
            name,
            isFile: () => !name.includes('/'),
            isDirectory: () => name.includes('/')
          });
        }
      }
    }
    return Promise.resolve(entries);
  })
};

fs.promises = promises;
fs.__setMockFiles = __setMockFiles;
fs.__setConfig = __setConfig;

module.exports = fs;
