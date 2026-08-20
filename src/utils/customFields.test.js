// 관리자 커스텀 필드 회귀 — 권한, key 자동 생성·충돌 처리, 값 조회, 삭제.
import {
  getCustomFields, getCustomField, getCustomFieldValue, saveCustomField, deleteCustomField,
} from './customFields';

const MASTER = { userId: 'master', role: 'master', displayName: '관리자' };
const TEACHER = { userId: 'teacher1', displayName: '김교사' };

beforeEach(() => {
  localStorage.clear();
});

describe('권한', () => {
  test('일반 사용자는 필드를 만들거나 지울 수 없다', () => {
    expect(saveCustomField({ label: '원장님 이름', value: '홍길동' }, TEACHER).ok).toBe(false);
    expect(getCustomFields()).toHaveLength(0);
  });

  test('관리자는 필드를 만들고 지울 수 있다', () => {
    const r = saveCustomField({ label: '원장님 이름', value: '홍길동' }, MASTER);
    expect(r.ok).toBe(true);
    expect(getCustomFields()).toHaveLength(1);
    expect(deleteCustomField(r.field.id, TEACHER).ok).toBe(false);
    expect(deleteCustomField(r.field.id, MASTER).ok).toBe(true);
    expect(getCustomFields()).toHaveLength(0);
  });
});

describe('key 자동 생성', () => {
  test('라벨에서 key를 자동으로 만들고, 같은 라벨을 또 만들면 겹치지 않게 번호가 붙는다', () => {
    const a = saveCustomField({ label: '전화번호', value: '02-1111' }, MASTER);
    const b = saveCustomField({ label: '전화번호', value: '02-2222' }, MASTER);
    expect(a.field.key).not.toBe(b.field.key);
    expect(new Set([a.field.key, b.field.key]).size).toBe(2);
  });

  test('제목이 없으면 거부된다', () => {
    expect(saveCustomField({ label: '', value: 'x' }, MASTER).ok).toBe(false);
  });
});

describe('값 조회·수정', () => {
  test('getCustomFieldValue로 값을 바로 가져올 수 있다', () => {
    const r = saveCustomField({ label: '원장님 이름', value: '홍길동' }, MASTER);
    expect(getCustomFieldValue(r.field.key)).toBe('홍길동');
    expect(getCustomFieldValue('없는키')).toBe('');
  });

  test('같은 id로 다시 저장하면 값이 수정된다(key는 유지)', () => {
    const r = saveCustomField({ label: '원장님 이름', value: '홍길동' }, MASTER);
    const r2 = saveCustomField({ id: r.field.id, label: '원장님 이름', value: '김철수' }, MASTER);
    expect(r2.field.key).toBe(r.field.key);
    expect(getCustomFieldValue(r.field.key)).toBe('김철수');
    expect(getCustomFields()).toHaveLength(1);
  });

  test('getCustomField로 단건 조회할 수 있다', () => {
    saveCustomField({ label: '전화번호', value: '02-1234' }, MASTER);
    const field = getCustomFields()[0];
    expect(getCustomField(field.key)?.value).toBe('02-1234');
    expect(getCustomField('없는키')).toBeNull();
  });
});
