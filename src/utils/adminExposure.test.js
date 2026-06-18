import fs from 'fs';
import path from 'path';

// 일반 사용자에게 보이는 페이지에는 관리자/엔진 검수 모듈이 유입되면 안 된다.
// (엔진명·점수·fallback 사유·전환 버튼·검수 리포트 등은 마스터 전용 컴포넌트에서만 다룬다)
const USER_PAGES = [
  'RecordPage.js', 'TodayPage.js', 'DocsPage.js', 'ChildrenPage.js',
  'NotePage.js', 'CheckPage.js', 'StatsPage.js',
];

// import되면 사용자 화면에 엔진/검수 정보가 새어 나올 수 있는 모듈/컴포넌트
const FORBIDDEN_IMPORTS = [
  'engineReviewReport', 'engineComparison', 'engineSampleRunner',
  'userCorrectionLearning', 'qualityScorer', 'documentEngineResolver',
  'documentEngineSettings', 'EngineComparePanel', 'EngineReviewReport',
];
// 사용자 화면에 노출되면 안 되는 표시 토큰
const FORBIDDEN_TOKENS = ['qualityScore', 'modularDrafts', 'fallback 사유', 'speech_not_preserved', 'legacy 엔진'];

describe('일반 사용자 화면에 관리자/엔진 정보 비노출', () => {
  USER_PAGES.forEach((page) => {
    test(`${page}는 엔진/검수 모듈을 import하지 않고 내부 토큰을 노출하지 않는다`, () => {
      const file = path.join(__dirname, '..', 'pages', page);
      if (!fs.existsSync(file)) return; // 페이지가 없으면 통과
      const src = fs.readFileSync(file, 'utf8');
      FORBIDDEN_IMPORTS.forEach((mod) => {
        expect(src).not.toContain(`/${mod}'`);
        expect(src).not.toContain(`/${mod}"`);
      });
      FORBIDDEN_TOKENS.forEach((tok) => expect(src).not.toContain(tok));
    });
  });

  test('엔진 검수 UI 컴포넌트는 마스터 게이트(isMaster) 안에서만 장착된다', () => {
    const settings = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SettingsPage.js'), 'utf8');
    // EngineComparePanel / EngineReviewReport 사용처는 isMaster() 블록 내부에 있어야 한다
    ['EngineComparePanel', 'EngineReviewReport'].forEach((comp) => {
      const idx = settings.indexOf(`<${comp}`);
      expect(idx).toBeGreaterThan(-1);
      const before = settings.slice(0, idx);
      // 직전에 isMaster() 게이트가 존재한다
      expect(before).toMatch(/isMaster\(\)\s*&&/);
    });
  });
});
