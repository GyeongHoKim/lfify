const path = jest.createMockFromModule('path');

const actualPath = jest.requireActual('path');

path.join = jest.fn().mockImplementation((...paths) => {
  return actualPath.join(...paths);
});

path.resolve = jest.fn().mockImplementation((...paths) => {
  return actualPath.resolve(...paths);
});

path.relative = jest.fn().mockImplementation((from, to) => {
  return actualPath.relative(from, to);
});

module.exports = path; 