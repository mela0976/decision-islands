import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { ARTICLE_ORDER, INTERACTIONS, WORLD_SEED, buildData } from '../public/immersive/data.js';

const editionUrl = new URL('../public/data/2026.json', import.meta.url);
const sourceEdition = JSON.parse(await readFile(editionUrl, 'utf8'));
const data = buildData(sourceEdition);

const articleById = new Map(sourceEdition.articles.map((article) => [article.id, article]));
const islandById = new Map(data.islands.map((island) => [island.id, island]));
const sceneByArticleId = new Map(data.scenes.map((scene) => [scene.articleId, scene]));

test('buildData maps the full 2026 source edition onto all 22 canonical islands', async () => {
  assert.deepEqual(ARTICLE_ORDER, [
    'I01', 'I02', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09',
    'M01', 'M02', 'M03', 'M04', 'M05', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06',
  ]);
  assert.equal(data.meta.articleCount, 22);
  assert.equal(data.meta.islandCount, 22);
  assert.equal(data.islands.length, 22);
  assert.deepEqual(data.chapters.map(({ id, articleIds }) => [id, articleIds.length]), [
    ['intro', 2], ['people', 9], ['model', 5], ['ai', 6],
  ]);
  assert.deepEqual(data.islands.map(({ articleId }) => articleId), sourceEdition.articles.map(({ id }) => id));

  for (const island of data.islands) {
    const source = articleById.get(island.articleId);
    const article = data.articles.find(({ id }) => id === island.articleId);
    assert.ok(source, `island ${island.id} points to a source article`);
    assert.equal(article.islandId, island.id);
    assert.equal(island.chapterId, source.chapter);
    assert.deepEqual(article.paragraphs, source.paragraphs, `${source.id} keeps the full article text`);
    assert.equal(article.fullArticle.articleId, source.id);
    assert.equal(article.fullArticle.url, `/read/2026/${source.id}.html`);
    assert.deepEqual(article.fullArticle.pages, source.sourcePages);
    await access(new URL(`../public/read/2026/${source.id}.html`, import.meta.url));
    assert.equal(article.reading.thirtySecond.text, source.summary);
    assert.deepEqual(article.reading.threeMinute.paragraphs, [source.summary, ...source.highlights]);
  }
});

test('fixed-seed coordinates are deterministic, irregular, unique, and grouped by chapter', () => {
  assert.equal(data.meta.seed, WORLD_SEED);
  const repeated = buildData(sourceEdition);
  assert.deepEqual(repeated.islands.map(({ id, position }) => [id, position]), data.islands.map(({ id, position }) => [id, position]));
  assert.equal(new Set(data.islands.map(({ position }) => `${position.x},${position.z}`)).size, 22);

  for (const chapter of data.chapters) {
    const points = chapter.articleIds.map((articleId) => data.islands.find((island) => island.articleId === articleId).position);
    assert.ok(new Set(points.map(({ x }) => x)).size > 1, `${chapter.id} varies on the x axis`);
    assert.ok(new Set(points.map(({ z }) => z)).size > 1, `${chapter.id} varies on the z axis`);
    assert.ok(points.every(({ x, z }) => Number.isFinite(x) && Number.isFinite(z)));
  }
  assert.ok(new Set(data.islands.map(({ position }) => position.x.toFixed(1))).size > 10, 'positions do not fall on a small regular grid');
});

test('each article has a main-story route and two source-grounded extension routes', () => {
  const articleIds = new Set(data.articles.map(({ id }) => id));
  const edgesBySource = new Map(data.articles.map(({ id }) => [id, data.articleGraph.filter((edge) => edge.sourceArticleId === id)]));

  for (const articleId of articleIds) {
    const edges = edgesBySource.get(articleId);
    assert.equal(edges.filter(({ priority }) => priority === 1).length, 1, `${articleId} has a main-story continuation`);
    assert.equal(edges.filter(({ priority }) => priority > 1).length, 2, `${articleId} has two extension routes`);
    for (const edge of edges) {
      assert.ok(articleIds.has(edge.targetArticleId), `${articleId} links to an included article`);
      assert.ok(edge.sourceArticleId !== edge.targetArticleId);
      assert.ok(edge.editorialReason.length > 20);
      assert.ok(edge.transitionQuestion.endsWith('？') || edge.transitionQuestion.endsWith('?'));
      assert.ok(edge.transitionVisual.length > 10);
    }
  }

  assert.ok(data.articleGraph.some(({ relationType }) => relationType === 'problem-cause'));
  assert.ok(data.articleGraph.some(({ relationType }) => relationType === 'concept-deepening'));
  assert.ok(data.articleGraph.some(({ relationType }) => relationType === 'different-viewpoint'));
  assert.ok(data.articleGraph.some(({ relationType }) => relationType === 'research-validation'));
  assert.ok(data.articleGraph.some(({ relationType }) => relationType === 'practical-application'));
  assert.ok(data.articleGraph.some(({ relationType }) => relationType === 'later-reflection'));

  const articleIdForIsland = (islandId) => islandById.get(islandId).articleId;
  for (const [source, target] of [['P01', 'P04'], ['P05', 'A06'], ['M01', 'M03']]) {
    assert.ok(data.articleGraph.some((edge) => edge.sourceArticleId === articleIdForIsland(source) && edge.targetArticleId === articleIdForIsland(target)));
  }

  const neighbors = new Map([...articleIds].map((id) => [id, new Set()]));
  for (const edge of data.articleGraph) {
    neighbors.get(edge.sourceArticleId).add(edge.targetArticleId);
    neighbors.get(edge.targetArticleId).add(edge.sourceArticleId);
  }
  const visited = new Set();
  const queue = [data.articles[0].id];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    queue.push(...neighbors.get(current));
  }
  assert.equal(visited.size, 22, 'every article belongs to one connected graph');
});

test('the 22-scene story returns to Achi and every island has its own fictional event', () => {
  const route = data.storyRoutes.find(({ id }) => id === 'main-story');
  assert.ok(route);
  assert.equal(route.articleIds.length, 22);
  assert.equal(new Set(route.articleIds).size, 22);
  assert.equal(route.ending.characterId, 'achi');
  assert.equal(route.ending.returnToArticleId, route.articleIds[0]);
  assert.equal(route.transitions.length, 22);

  assert.equal(data.characters.length, 4);
  assert.deepEqual(data.characters.map(({ id }) => id), ['achi', 'yue', 'yingzhen', 'fenjie']);
  assert.ok(data.meta.contentDisclosure.includes('虛構'));
  assert.equal(data.scenes.length, 22);
  assert.equal(new Set(data.scenes.map(({ lifeEvent }) => lifeEvent)).size, 22);
  assert.equal(new Set(data.scenes.map(({ coreDevice }) => coreDevice.id)).size, 22);
  for (const scene of data.scenes) {
    assert.ok(articleById.has(scene.articleId));
    assert.ok(scene.setting.length > 15);
    assert.ok(scene.lifeEvent.length > 15);
    assert.ok(scene.coreDevice.description.length > 15);
    assert.ok(scene.characterIds.includes(scene.protagonistId));
    assert.ok(scene.dialogue.length >= 1);
    assert.ok(scene.dialogue.every(({ fictional, kind }) => fictional && kind === 'fictional-dialogue'));
  }
});

test('the eight interaction registries have article-specific inputs and mapped output data', () => {
  assert.equal(INTERACTIONS.length, 8);
  assert.deepEqual(data.interactions.map(({ kind }) => kind), [
    'sourceverification', 'purchase', 'attention', 'memory', 'persona', 'judgment', 'journey', 'delegation',
  ]);
  const interactionById = new Map(data.interactions.map((interaction) => [interaction.id, interaction]));

  assert.equal(data.scenes.length, 22);
  for (const island of data.islands) {
    const scene = sceneByArticleId.get(island.articleId);
    const definition = interactionById.get(scene.interactionId);
    assert.ok(definition, `${island.id} resolves its interaction definition`);
    assert.equal(scene.interactionType, definition.kind);
    assert.equal(island.interactionId, scene.interactionId);
    assert.ok(scene.interaction.prompt.length > 15);
    assert.equal(scene.interaction.control.type, definition.inputType);
    assert.ok(scene.interaction.control.options.length >= 3, `${island.id} offers a real choice set`);
    const optionIds = scene.interaction.control.options.map(({ id }) => id);
    const outcomeIds = scene.interaction.outcomes.map(({ choiceId }) => choiceId);
    assert.deepEqual(new Set(outcomeIds), new Set(optionIds), `${island.id} returns data for every input choice`);
    assert.ok(scene.interaction.outcomes.every(({ title, text, insightTag, sourceArticleId, sourceEvidence }) => (
      title && text && insightTag && sourceArticleId === island.articleId
      && (sourceEvidence === articleById.get(island.articleId).summary || articleById.get(island.articleId).highlights.includes(sourceEvidence))
    )));
    assert.ok(scene.interaction.sourceEvidence === articleById.get(island.articleId).summary
      || articleById.get(island.articleId).highlights.includes(scene.interaction.sourceEvidence));
  }
});

test('chapter themes, reading progress, and Traditional Chinese labels are complete', () => {
  assert.equal(data.visualThemes.length, 4);
  assert.deepEqual(data.visualThemes.map(({ chapterId }) => chapterId), ['intro', 'people', 'model', 'ai']);
  assert.ok(data.visualThemes.every(({ palette, motifs, atmosphere }) => palette.length >= 3 && motifs.length >= 3 && atmosphere));
  assert.deepEqual(data.progressConfig.modes, ['story', 'explore']);
  assert.equal(data.progressConfig.insightStamps.length, 10);
  assert.equal(data.progressConfig.stampsAreReadingFootprints, true);
  assert.equal(data.progressConfig.interactionsAreOptional, true);
  assert.equal(data.i18n.locale, 'zh-TW');
  assert.ok(data.i18n.labels.fullArticle);
});

test('buildData rejects malformed source editions instead of returning partial islands', () => {
  assert.throws(() => buildData({ articles: [] }), /Expected an edition containing 22 articles/);
  const wrongChapter = structuredClone(sourceEdition);
  wrongChapter.articles[0].chapter = 'people';
  assert.throws(() => buildData(wrongChapter), /requires intro/);
  const wrongSourceId = structuredClone(sourceEdition);
  wrongSourceId.articles[0].id = '2026-03';
  assert.throws(() => buildData(wrongSourceId), /must be the source article 2026-01/);
});
