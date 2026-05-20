const fs = require('fs').promises;

async function cacheTaxonomy() {
    console.log("🦋 곤충강(Insecta) 하위 '목(Order)' 데이터를 가져오는 중...");
    
    // Insecta (216)
    const orderSearchUrl = 'https://api.gbif.org/v1/species/search?datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&highertaxonKey=216&rank=ORDER&status=ACCEPTED&limit=100';
    
    try {
        const orderRes = await fetch(orderSearchUrl);
        const orderData = await orderRes.json();
        
        if (!orderData.results || orderData.results.length === 0) {
            console.log("데이터를 찾을 수 없습니다.");
            return;
        }

        const orders = [];
        const families = [];
        
        // 주요 곤충강 목(Order) 한글명 매핑 사전
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
        
        console.log(`총 ${orderData.results.length}개의 목(Order) 데이터를 찾았습니다.`);
        console.log("각 목(Order)의 하위 과(Family) 데이터를 수집합니다. (이 작업은 몇 분 정도 소요될 수 있습니다...)");

        for (const orderItem of orderData.results) {
            const orderKey = orderItem.key;
            const orderSciName = orderItem.scientificName;
            
            // 1순위: 사전에 정의된 한글명이 있으면 바로 사용
            let orderCommonName = koreanOrderNames[orderSciName] || orderSciName;

            // 2순위: 사전에 없는 경우 GBIF 다국어 일반명 검색
            if (orderCommonName === orderSciName) {
                try {
                    const vRes = await fetch(`https://api.gbif.org/v1/species/${orderKey}/vernacularNames?limit=1000`);
                    const vData = await vRes.json();
                    if (vData.results && vData.results.length > 0) {
                        const kName = vData.results.find(v => v.language === 'kor' || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(v.vernacularName));
                        if (kName) orderCommonName = kName.vernacularName;
                    }
                } catch (e) {}
            }

            orders.push({
                usageKey: orderKey,
                scientificName: orderSciName,
                commonName: orderCommonName
            });

            console.log(`- ${orderSciName} (${orderCommonName}) 하위 과(Family) 수집 중...`);

            // 2. 해당 목(Order)의 하위 과(Family) 모두 검색 (limit=1000)
            const familySearchUrl = `https://api.gbif.org/v1/species/search?datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&highertaxonKey=${orderKey}&rank=FAMILY&status=ACCEPTED&limit=1000`;
            try {
                const famRes = await fetch(familySearchUrl);
                const famData = await famRes.json();
                
                if (famData.results) {
                    for (const famItem of famData.results) {
                        const familyKey = famItem.key;
                        const familySciName = famItem.scientificName;
                        let familyCommonName = familySciName;

                        // 과(Family) 한글 이름 검색 -> API 호출이 너무 많아지면 제외할 수 있으나 우선 포함
                        try {
                            const fvRes = await fetch(`https://api.gbif.org/v1/species/${familyKey}/vernacularNames?limit=100`);
                            const fvData = await fvRes.json();
                            if (fvData.results) {
                                const fkName = fvData.results.find(v => v.language === 'kor' || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(v.vernacularName));
                                if (fkName) familyCommonName = fkName.vernacularName;
                            }
                        } catch(e) {}

                        families.push({
                            usageKey: familyKey,
                            orderKey: orderKey, // 데이터 연동(Foreign Key)을 위한 연결 고리
                            scientificName: familySciName,
                            commonName: familyCommonName
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, 10)); // API Rate limit 방지
                    }
                }
            } catch (e) {
                console.error(`과(Family) 수집 에러:`, e.message);
            }
        }

        // 3. 파일로 각각 저장 (테이블 분리 형태)
        await fs.writeFile('cached_orders.json', JSON.stringify(orders, null, 2), 'utf-8');
        await fs.writeFile('cached_families.json', JSON.stringify(families, null, 2), 'utf-8');
        
        console.log(`\n🎉 완료!`);
        console.log(`- 목(Order): ${orders.length}개 -> 'cached_orders.json'에 저장됨`);
        console.log(`- 과(Family): ${families.length}개 -> 'cached_families.json'에 저장됨`);

    } catch (error) {
        console.error("데이터 캐싱 중 에러 발생:", error);
    }
}

cacheTaxonomy();
