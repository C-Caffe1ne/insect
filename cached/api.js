// 파일 시스템 모듈: 완성된 데이터를 JSON 파일로 저장하기 위해 필요합니다.
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');

// TODO: 본인의 Supabase 프로젝트 URL과 API Key로 변경해주세요.
const SUPABASE_URL = 'https://lwuvgxgbvyjqagsuaamr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dXZneGdidnlqcWFnc3VhYW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNDI1NTIsImV4cCI6MjA5NDYxODU1Mn0.6E0Uq3JOewHvpoJmQGswvk9dRSqT8rNOV_wUTaStZCU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function buildInsectEncyclopedia(searchName) {
    console.log(`[1] GBIF에서 '${searchName}' 검색 중...`);

    try {
        // --- STEP 1: GBIF API에서 분류 및 학명 가져오기 ---
        // name 매개변수에 검색어를 넣고, 곤충강(Insecta)으로 한정합니다.
        const gbifUrl = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(searchName)}&class=Insecta`;
        const gbifResponse = await fetch(gbifUrl);
        const gbifData = await gbifResponse.json();

        // 검색 결과가 없는 경우 예외 처리
        if (gbifData.matchType === 'NONE') {
            console.log("GBIF에서 곤충을 찾을 수 없습니다.");
            return;
        }

        const scientificName = gbifData.scientificName;
        console.log(`성공! 학명 확인: ${scientificName}`);

        // --- STEP 1-2: GBIF API를 통해 한글 이름(common_name) 가져오기 ---
        let commonName = gbifData.canonicalName; // 기본값은 영문/라틴어 이름
        const usageKey = gbifData.usageKey || gbifData.key;
        
        if (usageKey) {
            try {
                console.log(`[1-2] GBIF에서 '${scientificName}'의 한글 이름 찾는 중...`);
                // GBIF의 해당 종(species) 번호로 다국어 일반명 목록 가져오기 (결과가 많을 수 있으므로 limit 늘림)
                const gbifVernacularUrl = `https://api.gbif.org/v1/species/${usageKey}/vernacularNames?limit=1000`;
                const gbifVernacularRes = await fetch(gbifVernacularUrl);
                const gbifVernacularData = await gbifVernacularRes.json();

                if (gbifVernacularData.results && gbifVernacularData.results.length > 0) {
                    // 언어 코드가 'kor' 이거나, 텍스트에 한글이 포함된 데이터 찾기
                    const koreanNameObj = gbifVernacularData.results.find(
                        item => item.language === 'kor' || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(item.vernacularName)
                    );
                    
                    if (koreanNameObj) {
                        commonName = koreanNameObj.vernacularName;
                        console.log(`성공! 한글 이름 확인: ${commonName}`);
                    } else {
                        console.log(`한글 이름이 존재하지 않아 기본 이름을 사용합니다: ${commonName}`);
                    }
                }
            } catch (error) {
                console.log(`⚠️ 한글 이름을 가져오는 중 에러 발생: ${error.message}`);
            }
        }

        // --- STEP 2: EOL Cypher API에서 특징(Traits) 가져오기 ---
        console.log(`[2] EOL Cypher API에서 '${scientificName}' 특징 수집 중...`);
        const eolToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiaHdhbmdoczUyOTBAZ21haWwuY29tIiwiZW5jcnlwdGVkX3Bhc3N3b3JkIjoiJDJhJDExJGlwRFlhd01JTHp5L2t6WklXL0Y5WU85QXl4ZndNVFV0VkkzRXdLZmhRdTBLYkNQVE45emdPIn0.s7LgxThV6O3q8TMzXFTlS8buB_3eEmO9JpKnPP77Dns';
        
        // 검색할 학명에서 저자 및 연도 부분 제거 (Cypher 검색용)
        // ex: 'Apis mellifera Linnaeus, 1758' -> 'Apis mellifera'
        const shortName = scientificName.split(' ').slice(0, 2).join(' ');

        const cypherQuery = `
MATCH (t:Trait)<-[:trait|inferred_trait]-(p:Page),
(t)-[:predicate]->(pred:Term)
WHERE p.canonical = "${shortName}" OR p.canonical = "${scientificName}"
OPTIONAL MATCH (t)-[:object_term]->(obj:Term)
OPTIONAL MATCH (t)-[:units_term]->(units:Term)
OPTIONAL MATCH (t)-[:object_page]->(p2:Page)
RETURN pred.name as predicate, t.measurement as measurement, obj.name as object, units.name as units, p2.canonical as object_page
LIMIT 200
`;

        const eolCypherUrl = `https://eol.org/service/cypher?query=${encodeURIComponent(cypherQuery)}&format=cypher`;
        
        const eolHeaders = {
            'Authorization': 'JWT ' + eolToken,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'application/json'
        };

        let description = "해당 곤충에 대한 특징 데이터가 EOL에 존재하지 않거나 가져올 수 없습니다.";

        try {
            const eolResponse = await fetch(eolCypherUrl, { headers: eolHeaders });
            
            if (eolResponse.ok) {
                const eolData = await eolResponse.json();
                
                if (eolData.data && eolData.data.length > 0) {
                    const traits = {};
                    for (const row of eolData.data) {
                        const predicate = row[0];
                        const measurement = row[1];
                        const object = row[2];
                        const units = row[3];
                        const object_page = row[4];
                        
                        if (!traits[predicate]) traits[predicate] = [];
                        
                        let val = "";
                        if (object) val = object;
                        else if (object_page) val = object_page;
                        else if (measurement) val = measurement + (units ? ' ' + units : '');
                        
                        if (val && !traits[predicate].includes(val)) {
                            traits[predicate].push(val);
                        }
                    }
                    
                    // 수집된 특징들을 하나의 문자열(설명)로 취합
                    const traitStrings = [];
                    for (const [key, values] of Object.entries(traits)) {
                        if (values.length > 0 && values[0] !== "") {
                            // 값이 너무 많을 경우 상위 5개만 보여줌
                            const displayValues = values.slice(0, 5).join(', ') + (values.length > 5 ? ' 등' : '');
                            traitStrings.push(`- ${key}: ${displayValues}`);
                        }
                    }
                    
                    if (traitStrings.length > 0) {
                        description = "특징 및 생태 정보:\n" + traitStrings.join('\n');
                    }
                }
            } else {
                console.log(`⚠️ EOL Cypher API 에러: 상태 코드 ${eolResponse.status}`);
            }
        } catch (error) {
            console.log(`⚠️ EOL Cypher API 호출 중 에러 발생: ${error.message}`);
        }

        // --- STEP 4: 원하는 형태로 데이터 병합하기 ---
        const finalInsectData = {
            searchQuery: searchName,
            names: {
                scientificName: scientificName,
                // GBIF에서 찾은 한글 이름 (없으면 영문)
                commonName: commonName
            },
            taxonomy: {
                kingdom: gbifData.kingdom || "N/A",   // 계
                phylum: gbifData.phylum || "N/A",     // 문
                class: gbifData.class || "N/A",       // 강
                order: gbifData.order || "N/A",       // 목
                family: gbifData.family || "N/A",     // 과
                genus: gbifData.genus || "N/A"        // 속
            },
            characteristics: description
        };

        // --- STEP 5: JSON 파일로 출력 (저장) ---
        // JSON.stringify의 세 번째 인자 '2'는 들여쓰기를 예쁘게 해주는 역할을 합니다.
        await fs.writeFile('insect_data.json', JSON.stringify(finalInsectData, null, 2), 'utf-8');
        console.log("🎉 완료! 'insect_data.json' 파일이 생성되었습니다.");

        // --- STEP 6: Supabase 데이터베이스에 저장 ---
        console.log(`[4] Supabase에 데이터 저장 중...`);

        // 'insects'라는 테이블에 데이터를 저장한다고 가정합니다.
        // 테이블 이름과 컬럼은 실제 Supabase 설정에 맞게 수정해야 합니다.
        const { data, error } = await supabase
            .from('insects') // TODO: 본인이 생성한 테이블 이름으로 변경하세요.
            .insert([
                {
                    search_query: finalInsectData.searchQuery,
                    scientific_name: finalInsectData.names.scientificName,
                    common_name: finalInsectData.names.commonName,
                    kingdom: finalInsectData.taxonomy.kingdom,
                    phylum: finalInsectData.taxonomy.phylum,
                    class: finalInsectData.taxonomy.class,
                    order_name: finalInsectData.taxonomy.order, // order는 예약어일 수 있어 order_name으로 주로 사용
                    family: finalInsectData.taxonomy.family,
                    genus: finalInsectData.taxonomy.genus,
                    characteristics: finalInsectData.characteristics
                }
            ]);

        if (error) {
            console.error("Supabase 저장 중 에러 발생:", error.message);
        } else {
            console.log("🎉 Supabase에 데이터가 성공적으로 저장되었습니다!");
        }

    } catch (error) {
        console.error("데이터를 가져오는 중 에러가 발생했습니다:", error);
    }
}

// 함수 실행 예시 (서양종 꿀벌 검색)
buildInsectEncyclopedia('Apis mellifera');