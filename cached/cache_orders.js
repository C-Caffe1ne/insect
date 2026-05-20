const fs = require('fs').promises;

async function cacheInsectOrders() {
    console.log("🦋 곤충강(Insecta) 하위 '목(Order)' 데이터를 가져오는 중...");
    
    // GBIF Backbone Taxonomy(d7dddbf4-2cf0-4f39-9b2a-bb099caae36c)에서 Insecta(216) 하위 Order 검색
    const searchUrl = 'https://api.gbif.org/v1/species/search?datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&highertaxonKey=216&rank=ORDER&status=ACCEPTED&limit=100';
    
    try {
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            console.log("데이터를 찾을 수 없습니다.");
            return;
        }

        const orders = [];
        
        // 주요 곤충강 목(Order) 한글명 매핑 사전 (GBIF/EOL에 데이터가 부족할 경우를 대비)
        const koreanOrderNames = {
            "Coleoptera": "딱정벌레목", "Lepidoptera": "나비목", "Hymenoptera": "벌목",
            "Diptera": "파리목", "Hemiptera": "노린재목", "Orthoptera": "메뚜기목",
            "Odonata": "잠자리목", "Mantodea": "사마귀목", "Blattodea": "바퀴목",
            "Plecoptera": "강도래목", "Ephemeroptera": "하루살이목", "Trichoptera": "날도래목",
            "Neuroptera": "풀잠자리목", "Megaloptera": "뱀잠자리목", "Mecoptera": "밑들이목",
            "Siphonaptera": "벼룩목", "Phasmida": "대벌레목", "Dermaptera": "집게벌레목",
            "Thysanoptera": "총채벌레목", "Psocodea": "다듬이벌레목", "Zoraptera": "민벌레목",
            "Embioptera": "흰개미붙이목", "Strepsiptera": "부채벌레목", "Raphidioptera": "약대벌레목",
            "Archaeognatha": "돌좀목", "Zygentoma": "좀목", "Grylloblattodea": "갈루아벌레목",
            "Mantophasmatodea": "대벌레붙이목", "Grylloblattoidea": "갈루아벌레목", "Phasmatoptera": "대벌레목"
        };
        
        console.log(`총 ${data.results.length}개의 목(Order) 데이터를 찾았습니다. 각 목의 한글 이름을 검색합니다...`);

        for (const item of data.results) {
            const usageKey = item.key;
            const scientificName = item.scientificName;
            
            // 1순위: 사전에 정의된 한글명이 있으면 바로 사용
            let commonName = koreanOrderNames[scientificName] || scientificName;

            // 2순위: 사전에 없는 경우 GBIF 다국어 일반명 검색
            if (commonName === scientificName) {
                const vernacularUrl = `https://api.gbif.org/v1/species/${usageKey}/vernacularNames?limit=1000`;
                try {
                    const vRes = await fetch(vernacularUrl);
                    const vData = await vRes.json();
                    
                    if (vData.results && vData.results.length > 0) {
                        const koreanNameObj = vData.results.find(
                            v => v.language === 'kor' || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(v.vernacularName)
                        );
                        if (koreanNameObj) {
                            commonName = koreanNameObj.vernacularName;
                        }
                    }
                } catch (err) {
                    console.error(`⚠️ ${scientificName} 이름 검색 중 에러:`, err.message);
                }
            }

            orders.push({
                usageKey: usageKey,
                scientificName: scientificName,
                commonName: commonName
            });
            
            // 너무 빠른 요청을 방지하기 위해 짧게 대기
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // 결과를 캐싱용 JSON 파일로 저장
        const outputPath = 'cached_insect_orders.json';
        await fs.writeFile(outputPath, JSON.stringify({
            cachedAt: new Date().toISOString(),
            total: orders.length,
            orders: orders
        }, null, 2), 'utf-8');
        
        console.log(`🎉 완료! 총 ${orders.length}개의 데이터가 '${outputPath}'에 저장(캐싱)되었습니다.`);

    } catch (error) {
        console.error("데이터 캐싱 중 에러 발생:", error);
    }
}

cacheInsectOrders();
