const micromatch = jest.createMockFromModule('micromatch');

micromatch.isMatch = jest.fn().mockImplementation((filePath, patterns) => {
  if (!Array.isArray(patterns)) {
    patterns = [patterns];
  }

  // 간단한 glob 패턴 매칭 구현
  return patterns.some(pattern => {
    // 정확한 매칭
    if (pattern === filePath) return true;

    // 와일드카드 매칭
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regexPattern}$`).test(filePath);
  });
});

module.exports = micromatch; 