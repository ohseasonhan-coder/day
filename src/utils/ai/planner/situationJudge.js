// 의미·상황 판정(6단계) — 키워드 하나가 아니라 trigger+required+excluded+needPeer를 함께 본다.
// 반환: { primary, secondary } (테마 객체 | null). 근거 없는 테마는 절대 활성화하지 않는다.
// 우선순위 = THEMES 배열 순서. secondary = primary.coexist 중 독립적으로 단서가 맞는 첫 테마.
import { THEMES, THEME_BY_ID } from '../rules/themes';

const clean = (s) => String(s || '').trim();

function matches(theme, src, hasPeer) {
  if (theme.needPeer && !hasPeer) return false;
  if (theme.excluded && theme.excluded.test(src)) return false;
  if (theme.required && !theme.required.test(src)) return false; // 필수 단서(예: 회복 단서) 없으면 비활성
  return theme.trigger.test(src);
}

export function judgeSituation(input) {
  const src = clean(input);
  if (!src) return { primary: null, secondary: null };
  const hasPeer = /(친구|또래)/.test(src);

  let primary = null;
  for (const th of THEMES) {
    if (matches(th, src, hasPeer)) { primary = th; break; }
  }
  if (!primary) return { primary: null, secondary: null };

  let secondary = null;
  for (const id of primary.coexist || []) {
    const th = THEME_BY_ID[id];
    if (th && matches(th, src, hasPeer)) { secondary = th; break; }
  }
  return { primary, secondary };
}

// 하위 호환 — 기존 readLearningSignal 형태({key,label}|null)
export function readSignalCompat(input) {
  const { primary } = judgeSituation(input);
  return primary ? { key: primary.id, label: primary.label } : null;
}

export default judgeSituation;
