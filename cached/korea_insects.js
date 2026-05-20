const fs = require('fs').promises;

async function fetchKoreanInsects() {
    console.log("🇰🇷 한국에서 발견되는 곤충 '목(Order)' 종류를 찾는 중...");
    
    // GBIF Occurrence API를 사용하여 한국(KR)에서 관찰된 곤충강(216) 데이터 중 목(Order)별 관찰 횟수를 가져옵니다.
    // facet=orderKey 를 사용하면 한국에서 실제 발견된 목의 고유번호 목록을 추출할 수 있습니다.
    const searchUrl = 'https://api.gbif.org/v1/occurrence/search?country=KR&taxonKey=216&facet=orderKey&facetLimit=100&limit=0';
    
    try {
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (!data.facets || data.facets.length === 0 || !data.facets[0].counts) {
            console.log("한국에서 발견된 곤충 데이터를 찾을 수 없습니다.");
            return;
        }

        const counts = data.facets[0].counts;
        const koreanOrders = [];
        
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
        
        console.log(`총 ${counts.length}개의 한국 서식 곤충 목(Order) 데이터를 찾았습니다. 학명 및 한글명을 변환 중...`);

        // 발견 횟수(관찰 기록 수)가 많은 순서대로 정리되어 있습니다.
        for (const item of counts) {
            const orderKey = item.name;
            const observationCount = item.count;
            
            // 각 목(Order)의 Key를 이용해 학명을 가져옴
            const taxonRes = await fetch(`https://api.gbif.org/v1/species/${orderKey}`);
            const taxonData = await taxonRes.json();
            
            const scientificName = taxonData.scientificName || taxonData.canonicalName;
            const commonName = koreanOrderNames[scientificName] || scientificName;

            koreanOrders.push({
                usageKey: parseInt(orderKey),
                scientificName: scientificName,
                commonName: commonName,
                koreaObservationCount: observationCount // 한국에서의 관찰 횟수
            });
            
            await new Promise(resolve => setTimeout(resolve, 30));
        }

        // 관찰 횟수가 많은 순으로 정렬 보장
        koreanOrders.sort((a, b) => b.koreaObservationCount - a.koreaObservationCount);

        const outputPath = 'korea_insect_orders.json';
        await fs.writeFile(outputPath, JSON.stringify({
            cachedAt: new Date().toISOString(),
            country: "South Korea (KR)",
            totalOrdersFound: koreanOrders.length,
            orders: koreanOrders
        }, null, 2), 'utf-8');
        
        console.log(`\n🎉 완료! 한국에서 발견되는 총 ${koreanOrders.length}개의 곤충 목(Order) 데이터가 '${outputPath}'에 정리되었습니다.`);

    } catch (error) {
        console.error("데이터 수집 중 에러 발생:", error);
    }
}

fetchKoreanInsects();
