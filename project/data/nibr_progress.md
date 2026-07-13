# NIBR eCatalog 캐싱 진행상황

**마지막 업데이트:** 2026-06-09
**상태:** 300종 추출, 병합, 검색 인덱스 연결 완료

## 결과

| 항목 | 상태 |
|------|------|
| eCatalog 페이지 범위 | p008–p636 |
| 추출 종 수 | 300종 |
| 최종 병합본 | `data/nibr_insects.json` |
| 프론트엔드 캐시 | `nibr_cache.json` |
| 검색 인덱스 연결 | 300 / 300종 |
| 전체 검색 가능 종 | 300종 |
| 목 분류 | 16목 |

## 섹션 파일

| 파일 | 종 수 |
|------|------:|
| `nibr_insects_partial.json` | 32 |
| `nibr_section4.json` | 19 |
| `nibr_section5.json` | 33 |
| `nibr_section6.json` | 11 |
| `nibr_section7.json` | 28 |
| `nibr_section8_9.json` | 55 |
| `nibr_section10.json` | 22 |
| `nibr_section11_12.json` | 26 |
| `nibr_section13_15.json` | 74 |
| **합계** | **300** |

## 데이터 완성도

| 필드 | 데이터가 있는 종 |
|------|-----------------:|
| 서식지 | 245종 |
| 형태 | 192종 |
| 생태 | 192종 |
| 기타 정보 | 147종 |

## 캐시 재생성

taxonomy 디렉터리는 사용하지 않는다. 아래 스크립트가 `nibr_insects.json`을 기준으로
NIBR 캐시를 만들고 `search_index.json`의 종과 연결한다.

```bash
cd project
node scripts/build_nibr_cache.mjs
```

스크립트 작업:

1. 학명을 최대 3단계(속·종·아종) canonical key로 정규화
2. `nibr_cache.json` 생성
3. 검색 인덱스를 NIBR 300종·16목으로 재구성
4. EOL 캐시에서 300종 외 항목 제거
5. 목·과·전체 종 수 재계산

## 프론트엔드 표시

- 검색 결과에 `NIBR` 배지 표시
- 16개 목 카드에서 해당 목의 전체 종으로 바로 이동
- 상세 페이지에서 NIBR 형태 설명을 우선 사용
- 형태 설명의 몸길이 값을 크기 UI에 자동 반영
- NIBR 서식지, 생태, 기타 정보 표시
- eCatalog 페이지와 목·과 정보를 데이터 출처 카드에 표시
- 값이 없는 크기·서식지·생애주기 섹션은 숨김

## JSON 스키마

```json
{
  "page": 218,
  "korean_name": "왕거위벌레",
  "scientific_name": "Paracycnotrachelus chinensis (Jekel)",
  "english_name": null,
  "order_korean": "딱정벌레목",
  "order_latin": "Coleoptera",
  "family_korean": "거위벌레과",
  "family_latin": "Attelabidae",
  "habitat": "서식지 문자열",
  "morphology": ["형태 설명"],
  "ecology": ["생태 설명"],
  "other": ["기타 정보"]
}
```
