import type { Edition } from './types';
import type { ExplorerConfig, ExplorerData, ExplorerState, ModelKind, ThemeDefinition } from './explorer-types';
const text = (zh: string, en: string) => ({ zh, en });
const theme = (id: string, zh: string, en: string, axial: readonly [
    number,
    number
], orders: number[], model: ModelKind, color: string, index: number): ThemeDefinition => ({
    id, title: text(zh, en), description: text(`網站策展導讀：從「${zh}」串讀原刊文章，模型僅為閱讀隱喻。`, `Curator guide: explore original articles through ${en.toLowerCase()}. Models are reading metaphors.`),
    axial, orders, models: [model, 'book', 'pavilion', 'observatory'], color,
    ground: (['brick', 'speckle', 'stripe'] as const)[index % 3], tree: (['pine', 'blossom', 'fruit', 'palm', 'willow'] as const)[index % 5],
    captions: orders.map((_, i) => text(`策展導讀 ${i + 1}：從${zh}的角度閱讀原文，文章觀點以全文為準。`, `Curator guide ${i + 1}: read the original through ${en.toLowerCase()}; consult the article for its claims.`)),
});
/** The sole editorial configuration. References are resolved against the supplied edition. */
export const DATA: ExplorerConfig = {
    seed: 20261023, title: text('決策群島', 'Decision Islands'), layout: { radius: 2.02, spacing: 2.28, top: .65, waterY: -.18 },
    themes: [
        theme('growth', '成長羅盤', 'Growth compass', [0, 0], [1, 4, 5, 14], 'globe', '#db6a41', 0),
        theme('human', '人性價值', 'Human value', [1, 0], [2, 3, 6, 7], 'studio', '#f2b5c6', 1),
        theme('trust', '真實信任', 'Authentic trust', [2, 0], [3, 6, 9, 19], 'lighthouse', '#58a6a6', 2),
        theme('community', '社群共鳴', 'Community voices', [2, -1], [2, 7, 9, 11], 'pavilion', '#fcea8b', 3),
        theme('attention', '注意力記憶', 'Attention and memory', [1, -1], [8, 10, 11, 13], 'stage', '#6f7fb5', 4),
        theme('insight', '消費洞察', 'Consumer insight', [0, -1], [5, 12, 14, 17], 'classroom', '#9cc27a', 5),
        theme('choice', '選擇場域', 'Choice context', [-1, 0], [13, 15, 18, 19], 'workshop', '#c5b5a7', 6),
        theme('experience', '顧客體驗', 'Customer experience', [-1, 1], [15, 17, 18, 22], 'bridge', '#86a8a6', 7),
        theme('culture', '組織轉型', 'Culture and change', [0, 1], [1, 5, 16, 21], 'garden', '#8db86f', 8),
        theme('craft', '創意製作', 'Creative production', [1, 1], [8, 19, 20, 21], 'book', '#b48560', 9),
        theme('governance', '判斷治理', 'Judgment and governance', [-2, 1], [14, 16, 20, 22], 'clock', '#3e7c8c', 10),
        theme('agents', '代理商務', 'Agent commerce', [0, 2], [2, 4, 7, 22], 'observatory', '#71806a', 11),
    ],
    roles: [
        ['curator', '策展員', 'Curator', 'badge', '#db6a41'], ['researcher', '研究者', 'Researcher', 'glasses', '#fff8f4'],
        ['reader', '長者讀者', 'Senior reader', 'cane', '#6f7fb5'], ['student', '學生', 'Student', 'cap', '#fcea8b'],
        ['parent', '家長讀者', 'Parent reader', 'stroller', '#f2b5c6'], ['cyclist', '騎車讀者', 'Cycling reader', 'bicycle', '#58a6a6'],
        ['gardener', '園丁讀者', 'Gardening reader', 'hat', '#71806a'], ['worker', '工作者', 'Worker', 'helmet', '#b48560'],
        ['traveler', '通勤旅人', 'Commuting reader', 'suitcase', '#86a8a6'],
    ].map(([id, zh, en, accessory, color]) => ({ id, title: text(zh, en), accessory: accessory as ExplorerConfig['roles'][number]['accessory'], color, skin: '#e6b78c' })),
    flows: [
        ['opening', 'growth', 'human', [1, 2], 'source', 'book', 'curator'],
        ['authenticity', 'human', 'trust', [3, 6], 'thematic', 'idea', 'researcher'],
        ['conversation', 'trust', 'community', [6, 9], 'thematic', 'data', 'reader'],
        ['shared-memory', 'community', 'attention', [9, 11], 'thematic', 'memory', 'traveler'],
        ['attention-insight', 'attention', 'insight', [13, 12], 'thematic', 'data', 'student'],
        ['source-sequence', 'insight', 'choice', [12, 13], 'source', 'book', 'parent'],
        ['decision-experience', 'choice', 'experience', [15, 17], 'thematic', 'idea', 'gardener'],
        ['experience-agents', 'experience', 'agents', [18, 22], 'thematic', 'book', 'cyclist'],
        ['craft-governance', 'craft', 'governance', [21, 20], 'pending', 'idea', 'reader'],
        ['culture-governance', 'culture', 'governance', [16, 20], 'thematic', 'data', 'worker'],
    ].map((entry, index) => {
        const [id, from, to, articleOrders, kind, cargo, role] = entry as [
            string,
            string,
            string,
            number[],
            'source' | 'thematic' | 'pending',
            'book' | 'idea' | 'memory' | 'data',
            string
        ];
        return { id, from, to, articleOrders, cargo, role, walkerCount: 4 + index % 11, evidence: { kind, rationale: kind === 'source'
                    ? text('來源串讀：同刊文章的讀序與頁碼可核對；不代表官方認證、合作或因果證據。', 'Source sequence: verify reading order and pages in the collected edition; no official endorsement, partnership or causal evidence.')
                    : kind === 'pending' ? text('待探索：這兩篇可如何互相比較？這是網站提問，不是既定事實或官方合作。', 'Open question: how might these articles compare? A curator question, not an established fact or official partnership.')
                        : text('策展主題：本站建議比較這兩篇原文的閱讀角度，不表示官方合作或因果關係。', 'Curated theme: this site suggests comparing these original readings; no official partnership or causal claim.') } };
    }),
    daySegments: [
        ['midnight', '午夜', 'Midnight', 0, 360, ['trust']], ['dawn', '清晨', 'Dawn', 360, 480, ['growth']],
        ['commute', '通勤', 'Commute', 480, 600, ['human', 'community']], ['day', '白天', 'Daytime', 600, 840, ['insight', 'choice']],
        ['afternoon', '午後', 'Afternoon', 840, 1080, ['craft', 'experience']], ['dusk', '黃昏', 'Dusk', 1080, 1260, ['attention', 'culture']],
        ['night', '夜讀', 'Night reading', 1260, 1440, ['governance', 'agents']],
    ].map(entry => { const [id, zh, en, startMinute, endMinute, islandIds] = entry as [
        string,
        string,
        string,
        number,
        number,
        string[]
    ]; return { id, title: text(zh, en), startMinute, endMinute, islandIds }; }),
    dayKeyframes: [
        [0, '1e2c58', '3f4f80', 'b4c2ff', 1.15, '94a2d8', '64566a', 1.85, 1, '5a88b2'],
        [300, '26365f', '4c5688', 'b8c4ff', 1, '96a4da', '66586c', 1.85, 1, '5c8ab4'],
        [360, '7f8fc4', 'f6c3a6', 'ffb48a', 1.3, 'f3c6b5', '6b5a5a', 1.1, .55, '8fb7c4'],
        [450, 'a9d1ea', 'fbe6d3', 'ffe2c4', 2.4, 'eaf2f6', '8a7a68', 1.25, 0, '9fcfd6'],
        [720, '9fd0ec', 'f4eee3', 'fff1de', 2.9, 'eef6fa', '8f8270', 1.35, 0, 'a9d8db'],
        [960, 'a6cfe6', 'f8e7d2', 'ffe3c0', 2.5, 'f1efe8', '8a7a66', 1.25, 0, '9fcbd2'],
        [1065, '8b8fc4', 'f7b98f', 'ff9f6a', 1.8, 'f6d2bc', '7d6660', 1.2, .3, '93a9bd'],
        [1140, '5a5e9e', 'd99aa6', 'ff9a7a', 1.3, 'c0b2e0', '655868', 1.35, .75, '6a7cab'],
        [1260, '22325f', '445488', 'c0ccff', 1.2, '98a8dc', '685a6e', 1.9, 1, '5a88b2'],
        [1440, '1e2c58', '3f4f80', 'b4c2ff', 1.15, '94a2d8', '64566a', 1.85, 1, '5a88b2'],
    ].map(entry => { const [minute, skyTop, horizon, sunColor, sunIntensity, hemiSky, hemiGround, hemiIntensity, night, water] = entry as [
        number,
        string,
        string,
        string,
        number,
        string,
        string,
        number,
        number,
        string
    ]; return { minute, skyTop: '#' + skyTop, horizon: '#' + horizon, sunColor: '#' + sunColor, sunIntensity, hemiSky: '#' + hemiSky, hemiGround: '#' + hemiGround, hemiIntensity, night, water: '#' + water }; }),
};
function requireData(ok: unknown, message: string): asserts ok { if (!ok)
    throw new Error(`Explorer data: ${message}`); }
export function buildExplorerData(config: ExplorerConfig, edition: Edition): ExplorerData {
    requireData(Number.isInteger(edition.year), 'invalid edition year');
    requireData(Number.isFinite(config.seed), 'invalid seed');
    const articleIds = new Set<string>(), orders = new Map<number, Edition['articles'][number]>();
    for (const article of edition.articles) {
        requireData(article.year === edition.year, `article ${article.id} belongs to another year`);
        requireData(article.id && !articleIds.has(article.id) && !orders.has(article.order), 'duplicate article ID/order');
        articleIds.add(article.id);
        orders.set(article.order, article);
    }
    requireData(config.themes.length > 0 && new Set(config.themes.map(t => t.id)).size === config.themes.length, 'duplicate or missing themes');
    requireData(new Set(config.themes.map(t => t.axial.join(','))).size === config.themes.length, 'duplicate island coordinates');
    const models = new Set<ModelKind>(['book', 'pavilion', 'classroom', 'observatory', 'studio', 'bridge', 'garden', 'stage', 'clock', 'globe', 'workshop', 'lighthouse']);
    const items: ExplorerData['items'][number][] = [];
    const covered = new Set<string>();
    const islands = config.themes.map(theme => {
        requireData(theme.axial.length === 2 && theme.axial.every(Number.isInteger), 'invalid axial coordinates');
        requireData(theme.models.length > 0 && theme.models.every(model => models.has(model)), 'invalid model registry');
        requireData(theme.orders.every(Number.isInteger) && new Set(theme.orders).size === theme.orders.length, 'invalid or duplicate theme article order');
        const owned = theme.orders.flatMap((order, index) => {
            const article = orders.get(order);
            if (!article)
                return [];
            const model = theme.models[index % theme.models.length];
            requireData(models.has(model), `invalid model ${model}`);
            requireData(theme.captions[index]?.zh && theme.captions[index]?.en, 'missing bilingual caption');
            const item = { id: `${edition.year}-${theme.id}-${article.id}`, islandId: theme.id, articleId: article.id, model, caption: theme.captions[index] };
            items.push(item);
            covered.add(article.id);
            return [item.id];
        });
        const { orders: _orders, models: _models, captions: _captions, ...island } = theme;
        return { ...island, itemIds: owned };
    });
    // Keep physical islands connected even when a later edition has sparse content.
    for (const article of [...edition.articles].sort((a, b) => a.order - b.order)) {
        if (covered.has(article.id))
            continue;
        const island = islands[article.order % islands.length];
        const item = { id: `${edition.year}-${island.id}-${article.id}`, islandId: island.id, articleId: article.id, model: 'book' as const, caption: text('策展導讀：本年度原刊文章。', 'Curator guide: an original article from this edition.') };
        items.push(item);
        island.itemIds.push(item.id);
    }
    requireData(new Set(items.map(i => i.id)).size === items.length, 'duplicate placement ID');
    const seen = new Set([islands[0].id]);
    while (true) {
        const before = seen.size;
        for (const a of islands)
            for (const b of islands)
                if (seen.has(a.id) && Math.max(Math.abs(a.axial[0] - b.axial[0]), Math.abs(a.axial[1] - b.axial[1]), Math.abs(a.axial[0] + a.axial[1] - b.axial[0] - b.axial[1])) === 1)
                    seen.add(b.id);
        if (seen.size === before)
            break;
    }
    requireData(seen.size === islands.length, 'island layout disconnected');
    requireData(Object.values(config.layout).every(Number.isFinite) && config.layout.radius > 0 && config.layout.spacing > 0, 'invalid layout');
    requireData(config.dayKeyframes.length >= 2, 'missing day keyframes');
    config.dayKeyframes.forEach((key, index) => { requireData(Object.values(key).every(v => typeof v === 'string' ? /^#[0-9a-f]{6}$/i.test(v) : Number.isFinite(v)), 'invalid day keyframe'); requireData(key.minute >= 0 && key.minute <= 1440 && (index === 0 || key.minute > config.dayKeyframes[index - 1].minute), 'unordered day keyframes'); });
    requireData(config.dayKeyframes[0].minute === 0 && config.dayKeyframes.at(-1)!.minute === 1440, 'day keyframes must cover midnight');
    const roles = new Set(config.roles.map(r => r.id));
    requireData(roles.size === config.roles.length && roles.size > 0, 'duplicate or missing role ID');
    requireData(config.roles.every(role => ['badge', 'glasses', 'cane', 'cap', 'stroller', 'bicycle', 'hat', 'helmet', 'suitcase'].includes(role.accessory)), 'invalid role accessory');
    requireData(new Set(config.flows.map(f => f.id)).size === config.flows.length, 'duplicate flow ID');
    const flows = config.flows.flatMap(flow => {
        requireData(islands.some(i => i.id === flow.from) && islands.some(i => i.id === flow.to), 'invalid flow endpoint');
        requireData(['source', 'thematic', 'pending'].includes(flow.evidence.kind) && ['book', 'idea', 'memory', 'data'].includes(flow.cargo), 'invalid flow evidence/cargo');
        requireData(roles.has(flow.role) && Number.isInteger(flow.walkerCount) && flow.walkerCount >= 4 && flow.walkerCount <= 14, 'invalid flow role/count');
        const sources = flow.articleOrders.map(order => orders.get(order));
        if (sources.some(a => !a) || !islands.find(i => i.id === flow.from)!.itemIds.length || !islands.find(i => i.id === flow.to)!.itemIds.length)
            return [];
        const { articleOrders: _orders, ...base } = flow;
        return [{ ...base, articleIds: sources.map(a => a!.id) }];
    });
    const daySegments = config.daySegments.map(segment => {
        requireData(Number.isFinite(segment.startMinute) && Number.isFinite(segment.endMinute) && segment.startMinute >= 0 && segment.endMinute <= 1440 && segment.startMinute < segment.endMinute, 'invalid day segment');
        requireData(segment.islandIds.every(id => islands.some(i => i.id === id)), 'unknown segment island');
        const { islandIds, ...base } = segment;
        return { ...base, itemIds: items.filter(i => islandIds.includes(i.islandId)).map(i => i.id) };
    });
    return { schemaVersion: 1, year: edition.year, title: config.title, seed: config.seed + edition.year - 2026, layout: { ...config.layout }, articles: [...edition.articles], islands, items, flows, roles: config.roles, daySegments, dayKeyframes: config.dayKeyframes };
}
export function initialExplorerState(language: 'zh' | 'en' = 'zh', reducedMotion = false): ExplorerState {
    return { selection: null, language, season: 'christmas', query: '', tab: 'themes', minute: 600, paused: false, reducedMotion, names: false, walkers: true, flows: false, journal: true, journalFilter: null, birdseye: false, listOpen: false, detailOpen: false, chapter: null, completedArticleIds: [], bookmarkedArticleIds: [] };
}
