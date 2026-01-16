const micromatch = jest.createMockFromModule('micromatch');

micromatch.isMatch = jest.fn().mockImplementation((filePath, patterns) => {
  if (!Array.isArray(patterns)) {
    patterns = [patterns];
  }

  // 간단한 glob 패턴 매칭 구현
  return patterns.some(pattern => {
    // 정확한 매칭
    if (pattern === filePath) return true;

    // glob 패턴을 정규식으로 변환
    // 플레이스홀더를 사용해서 순서 문제 해결
    const GLOBSTAR_SLASH = '___GLOBSTARSLASH___';
    const GLOBSTAR = '___GLOBSTAR___';

    let regexPattern = pattern
      // **/ 패턴을 플레이스홀더로 임시 변환
      .replace(/\*\*\//g, GLOBSTAR_SLASH)
      // ** 패턴을 플레이스홀더로 임시 변환
      .replace(/\*\*/g, GLOBSTAR)
      // {a,b} 패턴
      .replace(/\{([^}]+)\}/g, (_, group) => `(${group.split(',').join('|')})`)
      // 특수문자 이스케이프 (*, ?, / 제외)
      .replace(/[.+^$|()[\]\\]/g, '\\$&')
      // * 패턴: 슬래시를 제외한 모든 것 매칭
      .replace(/\*/g, '[^/]*')
      // ? 패턴: 슬래시를 제외한 한 문자 매칭
      .replace(/\?/g, '[^/]')
      // 플레이스홀더를 실제 정규식으로 변환
      .replace(new RegExp(GLOBSTAR_SLASH, 'g'), '(?:.*/)?')
      .replace(new RegExp(GLOBSTAR, 'g'), '.*');

    return new RegExp(`^${regexPattern}$`).test(filePath);
  });
});

module.exports = micromatch; 