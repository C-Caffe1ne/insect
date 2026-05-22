import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FAMILIES_DIR = path.join(ROOT, 'project', 'taxonomy', 'families');
const ORDERS_DIR = path.join(ROOT, 'project', 'taxonomy', 'orders');
const CACHE_FILE = path.join(__dirname, 'korea_insect_species_by_family.json');
const FAMILY_INDEX_FILE = path.join(FAMILIES_DIR, 'index.json');

function run() {
  if (!fs.existsSync(CACHE_FILE)) {
    console.error(`Cache file not found at ${CACHE_FILE}`);
    process.exit(1);
  }

  console.log('Loading cached species data...');
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  const cachedFamilies = cache.families || {};
  console.log(`Loaded ${Object.keys(cachedFamilies).length} cached families.`);

  let updatedCount = 0;
  let totalInsectsAdded = 0;
  const updates = [];

  // Recursive walk with logging
  function processDirectory(dir) {
    console.log(`Scanning directory: ${dir}`);
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        processDirectory(filePath);
      } else if (file.endsWith('.json') && file !== 'index.json') {
        const familyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Check if insects list is empty
        if (!familyData.insects || familyData.insects.length === 0) {
          const orderSciName = familyData.order?.scientificName;
          const familySciName = familyData.family?.scientificName;
          
          if (!orderSciName || !familySciName) {
            continue;
          }

          const key = `${orderSciName}::${familySciName}`;
          const cached = cachedFamilies[key];

          if (cached && cached.species && cached.species.length > 0) {
            console.log(`  Updating empty family: ${key} with ${cached.species.length} species`);
            const mappedInsects = cached.species.map(sp => {
              const ktsn = sp.url ? parseInt(sp.url.split('/').pop(), 10) || null : null;
              return {
                ktsn: ktsn,
                scientificName: sp.scientificName || '',
                commonName: sp.commonName || '',
                terminalLatinName: sp.species || '',
                nomenclaturalAuthor: '',
                namingYear: '',
                corsynSeYn: 'Y',
                egspcsYn: 'N',
                hrmflSpecsYn: 'N',
                dispYn: 'N',
                phspYn: 'N',
                korUnqBispYn: 'N',
                ntmYn: 'N',
                taxonomy: {
                  phylum: { scientificName: "Arthropoda", commonName: "절지동물문", ktsn: 120000013748 },
                  class: { scientificName: "Insecta", commonName: "곤충강", ktsn: 120000013749 },
                  order: { scientificName: orderSciName, commonName: familyData.order?.commonName || '', ktsn: familyData.order?.orderKtsn || null },
                  family: { scientificName: familySciName, commonName: familyData.family?.commonName || '', ktsn: familyData.family?.familyKtsn || null },
                  genus: { scientificName: sp.genus || '', commonName: '', ktsn: null },
                  subgenus: { scientificName: '', commonName: '', ktsn: null },
                  species: { scientificName: sp.species || '', commonName: sp.commonName || '', ktsn: null }
                },
                digitalContent: {
                  cachedAt: new Date().toISOString(),
                  source: "https://species.nibr.go.kr/gwsvc/openapi/rest/digital/bispconts/search",
                  totalElements: 0,
                  totalPages: 1,
                  thumbnailUrl: null,
                  thumbnail: null,
                  contents: { EO: [], FR: [], DT: [], EX: [] }
                }
              };
            });

            familyData.insects = mappedInsects;
            familyData.speciesCount = mappedInsects.length;
            familyData.generatedAt = new Date().toISOString();
            familyData.source = 'Merged from korea_insect_species_by_family.json (NIBR cached Excel species data)';

            fs.writeFileSync(filePath, JSON.stringify(familyData, null, 2) + '\n', 'utf8');
            
            // Track updates
            updates.push({
              orderId: familyData.order?.id,
              familyId: familyData.family?.id,
              scientificName: familySciName,
              count: mappedInsects.length
            });

            updatedCount++;
            totalInsectsAdded += mappedInsects.length;
          }
        }
      }
    }
  }

  processDirectory(FAMILIES_DIR);
  console.log(`Finished merging. Populated ${updatedCount} empty families with ${totalInsectsAdded} species total.`);

  if (updatedCount > 0) {
    console.log('Updating order JSON files...');
    // Update order files
    for (const update of updates) {
      const orderFilePath = path.join(ORDERS_DIR, `${update.orderId}.json`);
      if (fs.existsSync(orderFilePath)) {
        const orderData = JSON.parse(fs.readFileSync(orderFilePath, 'utf8'));
        let orderUpdated = false;
        if (orderData.families) {
          for (const family of orderData.families) {
            if (family.id === update.familyId) {
              family.speciesCount = update.count;
              orderUpdated = true;
              break;
            }
          }
        }
        if (orderUpdated) {
          fs.writeFileSync(orderFilePath, JSON.stringify(orderData, null, 2) + '\n', 'utf8');
        }
      }
    }

    // Update families/index.json if exists
    if (fs.existsSync(FAMILY_INDEX_FILE)) {
      console.log('Updating families/index.json...');
      const indexData = JSON.parse(fs.readFileSync(FAMILY_INDEX_FILE, 'utf8'));
      let indexUpdated = false;
      if (indexData.families) {
        for (const family of indexData.families) {
          const match = updates.find(u => u.orderId === family.orderId && u.familyId === family.familyId);
          if (match) {
            family.speciesCount = match.count;
            indexUpdated = true;
          }
        }
      }
      if (indexUpdated) {
        indexData.totalSpeciesRecords = (indexData.totalSpeciesRecords || 0) + totalInsectsAdded;
        fs.writeFileSync(FAMILY_INDEX_FILE, JSON.stringify(indexData, null, 2) + '\n', 'utf8');
      }
    }

    console.log('Successfully updated all data indexes!');
  }
}

run();
