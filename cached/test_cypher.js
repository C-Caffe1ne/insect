const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiaHdhbmdoczUyOTBAZ21haWwuY29tIiwiZW5jcnlwdGVkX3Bhc3N3b3JkIjoiJDJhJDExJGlwRFlhd01JTHp5L2t6WklXL0Y5WU85QXl4ZndNVFV0VkkzRXdLZmhRdTBLYkNQVE45emdPIn0.s7LgxThV6O3q8TMzXFTlS8buB_3eEmO9JpKnPP77Dns';

async function testCypher() {
    const query = `
MATCH (t:Trait)<-[:trait|inferred_trait]-(p:Page),
(t)-[:predicate]->(pred:Term)
WHERE p.canonical = "Apis mellifera"
OPTIONAL MATCH (t)-[:object_term]->(obj:Term)
OPTIONAL MATCH (t)-[:units_term]->(units:Term)
OPTIONAL MATCH (t)-[:object_page]->(p2:Page)
RETURN pred.name as predicate, t.measurement as measurement, obj.name as object, units.name as units, p2.canonical as object_page
LIMIT 200
`;
    
    const url = 'https://eol.org/service/cypher?query=' + encodeURIComponent(query) + '&format=cypher';
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': 'JWT ' + token,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'application/json'
            }
        });
        console.log('Status:', response.status);
        const text = await response.text();
        const data = JSON.parse(text);
        
        // Group by predicate
        const traits = {};
        for (const row of data.data) {
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
        console.log(traits);
        
    } catch (e) {
        console.error(e);
    }
}
testCypher();
