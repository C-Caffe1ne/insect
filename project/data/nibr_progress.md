# NIBR eCatalog 캐싱 진행상황

**마지막 업데이트:** 2026-06-08  
**이미지 경로:** `~/nibr_insects/XXX.jpg` (3자리 제로패딩, 007–637)  
**작업 규칙:** 짝수 페이지 = 종 정보, 홀수 페이지 = 사진 / 섹션 구분 이미지 예외

---

## 저장된 JSON 파일 목록

| 파일 | 페이지 범위 | 종 수 | 비고 |
|------|------------|-------|------|
| `nibr_insects_partial.json` | p007–p080 (추정) | 32종 | 섹션 1–3: 잠자리목·바퀴목·사마귀목 등 |
| `nibr_section4.json` | p082–p124 | 19종 | 메뚜기목 |
| `nibr_section5.json` | p124–p190 | 34종 | 대벌레목(1종) + 노린재목(33종) |
| `nibr_section6.json` | p191–p216 | 11종 | 풀잠자리목 |
| `nibr_section7.json` | p218–p272 | 28종 | 딱정벌레목 1/3 |
| `nibr_section11_12.json` | p430–p484 | 26종 | 파리목 2/2 + 밑들이목·날도래목 |
| **`nibr_insects.json`** | 전체 병합본 | **88종** | 위 파일들 병합 (페이지순 정렬) |

---

## ⚠️ 미저장 데이터 (다음 세션에서 먼저 저장 필요)

### `nibr_section8_9.json` — 딱정벌레목 2/3 (p274–p382), 54종

아래 데이터를 `nibr_section8_9.json`으로 저장 후 `nibr_insects.json`에 병합해야 함.

| 페이지 | 한국명 | 학명 | 과 |
|--------|--------|------|----|
| 274 | 오이잎벌레 | Aulacophora indica (Gmelin) | 잎벌레과 Chrysomelidae |
| 276 | 중국청람색잎벌레 | Chrysochus chinensis Baly | 잎벌레과 Chrysomelidae |
| 278 | 청줄보라잎벌레 | Chrysolina virgata (Motschulsky) | 잎벌레과 Chrysomelidae |
| 280 | 버들잎벌레 | Chrysomela vigintipunctata vigintipunctata (Scopoli) | 잎벌레과 Chrysomelidae |
| 282 | 상아잎벌레 | Gallerucida bifasciata Motschulsky | 잎벌레과 Chrysomelidae |
| 284 | 배노랑긴가슴잎벌레 | Lema concinnipennis Baly | 잎벌레과 Chrysomelidae |
| 286 | 남생이무당벌레 | Aiolocaria hexaspilota (Hope) | 무당벌레과 Coccinellidae |
| 288 | 칠성무당벌레 | Coccinella septempunctata Linnaeus | 무당벌레과 Coccinellidae |
| 290 | 무당벌레 | Harmonia axyridis (Pallas) | 무당벌레과 Coccinellidae |
| 292 | 큰이십팔점박이무당벌레 | Henosepilachna vigintioctomaculata (Motschulsky) | 무당벌레과 Coccinellidae |
| 294 | 긴점무당벌레 | Myzia oblongoguttata (Linnaeus) | 무당벌레과 Coccinellidae |
| 296 | 황초록바구미 | Chlorophanus grandis Roelofs | 바구미과 Curculionidae |
| 298 | 밤바구미 | Curculio sikkimensis (Heller) | 바구미과 Curculionidae |
| 300 | 털보바구미 | Enaptorhinus granulatus Pascoe | 바구미과 Curculionidae |
| 302 | 혹바구미 | Episomus turritus (Gyllenhal) | 바구미과 Curculionidae |
| 304 | 산길쭉바구미 | Lixus fasciculatus Boheman | 바구미과 Curculionidae |
| 306 | 애수시렁이 | Attagenus unicolor japonicus Reitter | 수시렁이과 Dermestidae |
| 308 | 홍띠수시렁이 | Dermestes vorax Motschulsky | 수시렁이과 Dermestidae |
| 310 | 왕바구미 | Sipalinus gigas (Fabricius) | 왕바구미과 Dryophthoridae |
| 312 | 어리쌀바구미 | Sitophilus zeamais Motschulsky | 왕바구미과 Dryophthoridae |
| 314 | 애기물방개 | Rhantus suturalis (Macleay) | 물방개과 Dytiscidae |
| 316 | 대유동방아벌레 | Agrypnus argillaceus argillaceus (Solsky) | 방아벌레과 Elateridae |
| 318 | 녹슬은방아벌레 | Agrypnus binodulus coreanus Kishii | 방아벌레과 Elateridae |
| 320 | 왕빗살방아벌레 | Pectocera fortunei Candèze | 방아벌레과 Elateridae |
| 322 | 보라금풍뎅이 | Phelotrupes auratus (Motschulsky) | 금풍뎅이과 Geotrupidae |
| 324 | 물땡땡이 | Hydrophilus acuminatus Motschulsky | 물땡땡이과 Hydrophilidae |
| 326 | 애사슴벌레 | Dorcus rectus rectus (Motschulsky) | 사슴벌레과 Lucanidae |
| 328 | 넓적사슴벌레 | Dorcus titanus castanicolor (Motschulsky) | 사슴벌레과 Lucanidae |
| 330 | 사슴벌레 | Lucanus maculifemoratus dybowskyi Parry | 사슴벌레과 Lucanidae |
| 332 | 톱사슴벌레 | Prosopocoilus inclinatus inclinatus (Motschulsky) | 사슴벌레과 Lucanidae |
| 334 | 남가뢰 | Meloe proscarabaeus proscarabaeus Linnaeus | 가뢰과 Meloidae |
| 336 | 권연벌레 | Lasioderma serricorne (Fabricius) | 표본벌레과 Ptinidae |
| 338 | 홍날개 | Pseudopyrochroa rufula (Motschulsky) | 홍날개과 Pyrochroidae |
| 340 | 주둥무늬차색풍뎅이 | Adoretus tenuimaculatus Waterhouse | 풍뎅이과 Scarabaeidae |
| 342 | 장수풍뎅이 | Allomyrina dichotoma (Linnaeus) | 풍뎅이과 Scarabaeidae |
| 344 | 카멜레온줄풍뎅이 | Anomala chamaeleon Fairmaire | 풍뎅이과 Scarabaeidae |
| 346 | 다색줄풍뎅이 | Anomala corpulenta Motschulsky | 풍뎅이과 Scarabaeidae |
| 348 | 등얼룩풍뎅이 | Blitopertha orientalis (Wathrhouse) | 풍뎅이과 Scarabaeidae |
| 350 | 등노랑풍뎅이 | Callistethus plagiicollis (Fairmaire) | 풍뎅이과 Scarabaeidae |
| 352 | 큰검정풍뎅이 | Holotrichia parallela (Motschulsky) | 풍뎅이과 Scarabaeidae |
| 354 | 왕풍뎅이 | Melolontha incana (Motschulsky) | 풍뎅이과 Scarabaeidae |
| 356 | 금줄풍뎅이 | Mimela holosericea (Fabricius) | 풍뎅이과 Scarabaeidae |
| 358 | 풍뎅이 | Mimela splendens (Gyllenhal) | 풍뎅이과 Scarabaeidae |
| 360 | 별줄풍뎅이 | Mimela testaceipes (Motschulsky) | 풍뎅이과 Scarabaeidae |
| 362 | 모가슴소똥풍뎅이 | Onthophagus fodiens Waterhouse | 풍뎅이과 Scarabaeidae |
| 364 | 렌지소똥풍뎅이 | Onthophagus lenzii Harold | 풍뎅이과 Scarabaeidae |
| 366 | 참콩풍뎅이 | Popillia flavosellata Fairmaire | 풍뎅이과 Scarabaeidae |
| 368 | 큰넓적송장벌레 | Necrophila jakowlewi jakowlewi (Semenov) | 송장벌레과 Silphidae |
| 370 | 검정송장벌레 | Nicrophorus concolor Kraatz | 송장벌레과 Silphidae |
| 372 | 홍딱지바수염반날개 | Aleochara curtula (Goeze) | 반날개과 Staphylinidae |
| 374 | 청딱지개미반날개 | Paederus fuscipes fuscipes Curtis | 반날개과 Staphylinidae |
| 376 | 제주거저리 | Blindus strigosus (Faldermann) | 거저리과 Tenebrionidae |
| 378 | 모래거저리 | Gonocephalum pubens (Marseul) | 거저리과 Tenebrionidae |
| 380 | 강변거저리 | Heterotarsus carinula Marseul | 거저리과 Tenebrionidae |
| 382 | 산맴돌이거저리 | Plesiophthalmus davidis Fairmaire | 거저리과 Tenebrionidae |

> **p384** = 파리목 섹션 구분 이미지 (데이터 없음)

---

## 남은 작업 순서

### 1단계: nibr_section8_9.json 저장
위 54종 데이터를 JSON으로 작성 후 저장.

### 2단계: nibr_section10.json — 파리목 1/2 (p386–p428)
- p386부터 짝수 페이지만 읽기
- p428까지 (p430은 이미 nibr_section11_12.json에 포함됨)

### 3단계: nibr_section13_15.json — 나비목·벌목 (p487–p637)
- p488부터 짝수 페이지만 읽기 (p486은 섹션 구분 이미지로 추정)
- p637까지

### 4단계: 최종 병합
```python
import json, os

data_dir = "/Users/hwanghyeonseong/Documents/GitHub/insect/project/data"
files = [
    "nibr_insects_partial.json",   # 32종
    "nibr_section4.json",          # 19종
    "nibr_section5.json",          # 34종
    "nibr_section6.json",          # 11종
    "nibr_section7.json",          # 28종
    "nibr_section8_9.json",        # 54종 (미저장)
    "nibr_section10.json",         # 미추출
    "nibr_section11_12.json",      # 26종
    "nibr_section13_15.json",      # 미추출
]
all_species = []
for f in files:
    path = os.path.join(data_dir, f)
    if os.path.exists(path):
        all_species.extend(json.load(open(path, encoding="utf-8")))
all_species.sort(key=lambda x: x["page"])
json.dump(all_species, open(os.path.join(data_dir, "nibr_insects.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"총 {len(all_species)}종 병합 완료")
```

---

## 현재 nibr_insects.json 구성 (88종)
섹션 1–3, 4, 5, 6, 7, 11–12만 병합된 상태.  
section8_9·section10·section13_15 추가 후 재병합 필요.

---

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
  "morphology": ["형태 설명 배열"],
  "ecology": ["생태 설명 배열"],
  "other": ["기타 정보 배열"]
}
```
