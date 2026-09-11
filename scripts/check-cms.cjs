const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const saved = new Map();
let failWrite = false;
const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => { if (failWrite) throw new Error('quota'); saved.set(key, value); }, removeItem: key => saved.delete(key) };
function contextLoader() {
  const cache = new Map();
  function load(file) {
    const full = path.resolve(file);
    if (cache.has(full)) return cache.get(full);
    const exports = {}; cache.set(full, exports);
    const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, structuredClone, crypto, localStorage: storage, sessionStorage: storage, navigator: {}, Event: class {}, window: { dispatchEvent() {} }, require: name => {
      if (name.startsWith('@/')) {
        if (name === '@/lib/supabase') return { supabase: null, hasSupabaseConfig: false, localAdminEnabled: true, verifyLocalAdminPassword: password => password === 'afhomes-local-test-2026' };
        if (/\.(png|jpg|webp)$/.test(name)) return { default: '/assets/image.png' };
        return load(`src/${name.slice(2)}.ts`);
      }
      return require(name);
    } });
    return exports;
  }
  return load;
}
(async () => {
  const load = contextLoader();
  const { cmsRepository: cms } = load('src/lib/cms.ts');
  const { validateDocument, backupSchema } = load('src/lib/cmsValidation.ts');
  await cms.hydrate();
  for (const [key, value] of Object.entries({ site: cms.getSiteConfig(), pageContent: cms.getPageContent(), experiences: cms.getAllExperiences(), vip: cms.getAllVipPlans(), faq: cms.getAllFaqCategories(), stories: cms.getAllStories() })) validateDocument(key, value);
  const sample = cms.getAllStories()[0];
  await cms.replaceStories([{ ...sample, id: 'active', slug: 'active' }, { ...sample, id: 'archived', slug: 'archived', archived: true }]);
  await cms.deleteStory('active');
  assert.equal(cms.getAllStories()[0].id, 'archived');
  const before = JSON.stringify(cms.getAllStories());
  failWrite = true;
  await assert.rejects(() => cms.replaceStories([]));
  assert.equal(JSON.stringify(cms.getAllStories()), before);
  failWrite = false;
  const other = contextLoader()('src/lib/cms.ts').cmsRepository;
  await other.hydrate();
  await cms.replaceStories([]);
  await assert.rejects(() => other.replaceStories([{ ...sample, id: 'conflict', slug: 'conflict' }]), /another tab/);
  assert.equal(other.getAllStories().length, 0);
  assert.equal(backupSchema.safeParse({}).success, false);
  assert.throws(() => validateDocument('vip', [{ ...cms.getAllVipPlans()[0], discountPercent: 101 }]));
  const mediaBlock = { id: 'media-test', page: '/', placement: 'after-page', kind: 'image', src: 'https://example.com/image.jpg', alt: 'Test image', caption: '', width: 'wide', fit: 'cover' };
  validateDocument('mediaBlocks', [mediaBlock]);
  await cms.saveMediaBlocks([mediaBlock]);
  assert.deepEqual(cms.getMediaBlocks(), [mediaBlock]);
  console.log('Local CMS checks passed: seed validation, archived stories, media blocks, failed writes, cross-tab conflicts, backup validation, and VIP limits.');
})().catch(error => { console.error(error); process.exitCode = 1; });
