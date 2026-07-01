# v3 피드백 엑셀 분석·비식별 변환 도구 (읽기 전용).
#  - 원본 파일은 절대 수정하지 않는다(openpyxl read_only=True).
#  - 개인정보를 제외한 메타데이터 통계만 콘솔에 출력한다.
#  - 비식별 골든 데이터셋 초안은 data/golden_local/ (gitignore)로만 저장한다.
# 사용: python scripts/analyze_v3.py [원본경로] [출력경로]
import os, re, sys, json, statistics
from collections import Counter

def main():
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass
    src = sys.argv[1] if len(sys.argv) > 1 else "쌤워크_피드백_서식_v3.xlsx"
    out_dir = "data/golden_local"
    out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(out_dir, "observation_golden.local.json")
    if not os.path.exists(src):
        print(json.dumps({"error": f"원본 없음: {src}"}, ensure_ascii=False)); return

    from openpyxl import load_workbook
    wb = load_workbook(src, read_only=True, data_only=True)  # 읽기 전용
    target = next((s for s in wb.sheetnames if "자동검수" in s), wb.sheetnames[0])
    ws = wb[target]

    header = [ws.cell(9, c).value for c in range(1, ws.max_column + 1)]
    # 열 인덱스(1-base): 3=이름, 4=입력, 5=관찰/배움, 6=교사지원, 7=복사용
    rows = []
    for r in ws.iter_rows(min_row=10):
        vals = [c.value for c in r]
        if not any(v not in (None, "") for v in vals):
            continue
        rows.append(vals)

    def cell(v): return "" if v is None else str(v).strip()
    name_col = [cell(r[2]) if len(r) > 2 else "" for r in rows]
    input_col = [cell(r[3]) if len(r) > 3 else "" for r in rows]
    obs_col = [cell(r[4]) if len(r) > 4 else "" for r in rows]
    copy_col = [cell(r[6]) if len(r) > 6 else "" for r in rows]

    total = len(rows)
    blank_input = sum(1 for x in input_col if not x)
    dup_input = total - len(set(input_col))
    lens = [len(x) for x in input_col if x]
    length_dist = {
        "min": min(lens) if lens else 0, "max": max(lens) if lens else 0,
        "mean": round(statistics.mean(lens), 1) if lens else 0,
        "median": statistics.median(lens) if lens else 0,
    }
    # 행 분류
    linkable = sum(1 for i in range(total) if input_col[i] and obs_col[i])          # 입력-정답 연결 가능
    example_only = sum(1 for i in range(total) if (not input_col[i]) and copy_col[i])  # 출력 예시 전용
    incomplete = sum(1 for i in range(total) if not input_col[i] and not copy_col[i])  # 불완전

    stats = {
        "sheet": target, "header": header, "rows": total,
        "blank_input_ratio": round(blank_input / total, 3) if total else 0,
        "duplicate_input_rows": dup_input,
        "input_length": length_dist,
        "classify": {"input_answer_linkable": linkable, "output_example_only": example_only, "incomplete": incomplete},
        "distinct_names": len(set(n for n in name_col if n)),
    }
    print("=== v3 메타데이터 통계(개인정보 제외) ===")
    print(json.dumps(stats, ensure_ascii=False, indent=2))

    # ── 비식별 골든 초안 생성 ────────────────────────────────────────────
    # 이름 → 익명 식별자 매핑(A원아, B원아 …). 텍스트 내 이름도 치환.
    uniq = [n for n in dict.fromkeys(name_col) if n]
    def anon_id(i):
        # A..Z, 이후 A2, B2 …
        return chr(65 + i % 26) + ("" if i < 26 else str(i // 26 + 1)) + "원아"
    name_map = {n: anon_id(i) for i, n in enumerate(uniq)}
    def deidentify(text):
        t = text
        for real, anon in name_map.items():
            if real:
                t = re.sub(re.escape(real), anon, t)
        return t

    draft = {"generatedFrom": os.path.basename(src), "count": 0, "note": "비식별 로컬 전용 — Git 추적 제외", "regressionCases": []}
    for i in range(total):
        if not input_col[i]:
            continue
        draft["regressionCases"].append({
            "id": f"v3_local_{i+1:04d}",
            "documentType": "observation",
            "input": deidentify(input_col[i]),
            "factCard": {"name": name_map.get(name_col[i], "원아"), "actions": [], "speeches": re.findall(r'"([^"]+)"', input_col[i]), "materials": [], "peers": [], "teacherSupport": None, "forbidden": []},
            "reference": {"observationOrLearning": deidentify(obs_col[i]), "copyReady": deidentify(copy_col[i])},
            "qualityTags": [],
        })
    draft["count"] = len(draft["regressionCases"])

    os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(draft, f, ensure_ascii=False, indent=1)
    print(f"\n비식별 골든 초안 저장(로컬·gitignore): {out_path} · {draft['count']}건 · 이름 {len(name_map)}종 익명화")
    print("주의: 원본 엑셀은 수정하지 않았고, 로컬 초안은 Git 추적 제외 경로에만 저장됩니다.")

if __name__ == "__main__":
    main()
