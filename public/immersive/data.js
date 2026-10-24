const WORLD_SEED = 0x20261126;
const MIN_ISLAND_SPACING = 18;
const CLUSTER_RADIUS_LIMIT = 48;
const CLUSTER_SAMPLE_RADIUS = 42;

const ARTICLE_ORDER = [
  'I01', 'I02', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09',
  'M01', 'M02', 'M03', 'M04', 'M05', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06',
];
const INSIGHT_STAMPS = {
  truth: ['P01', 'P07'], trust: ['I02', 'P04', 'A02'], preference: ['P05'],
  memory: ['P06', 'P09', 'A03'], attention: ['P08', 'M02'], people: ['P03', 'M01', 'M05'],
  judgment: ['I01', 'M03'], experience: ['P02', 'M04', 'A01'], governance: ['A04'], delegation: ['A05', 'A06'],
};

const CHAPTERS = [
  { id: 'intro', title: '序章群島', englishTitle: 'Intro', themeId: 'paper-shore', center: { x: -110, z: -110 }, articleRange: [0, 2] },
  { id: 'people', title: '人本群島', englishTitle: 'People', themeId: 'warm-streets', center: { x: 110, z: -110 }, articleRange: [2, 11] },
  { id: 'model', title: '洞察群島', englishTitle: 'Model', themeId: 'rose-lab', center: { x: 110, z: 110 }, articleRange: [11, 16] },
  { id: 'ai', title: 'AI 行動群島', englishTitle: 'AI', themeId: 'blue-current', center: { x: -110, z: 110 }, articleRange: [16, 22] },
];

const VISUAL_THEMES = [
  { id: 'paper-shore', chapterId: 'intro', palette: ['#e8e2d5', '#b3ad9f', '#333a3b'], material: '紙纖維、淺色石岸、柔光', motifs: ['折頁', '岸線', '鉛筆記號'], atmosphere: '問題剛浮上來，答案還沒有定形。', editorialMotifs: {
    I01: { proposal: { type: 'portrait', finish: 'photo', seed: 20261024, palette: ['#f4f0e7', '#222728', '#777a76'] } },
  } },
  { id: 'warm-streets', chapterId: 'people', palette: ['#d8c982', '#9a9d61', '#6e7651'], material: '暖色街道、植物、布料與木作', motifs: ['街角', '舞台', '生活物件'], atmosphere: '人的偏好、信任和記憶在日常裡發生。', editorialMotifs: {
    P01: {
      sourcePortrait: { type: 'portrait', finish: 'halftone', seed: 20261024, palette: ['#f4f0e7', '#222728', '#777a76'] },
      simulatedPortrait: { type: 'portrait', finish: 'pixel', seed: 20261024, palette: ['#f4f0e7', '#222728', '#777a76'] },
      flowerPaper: { type: 'flower-paper', seed: 9021, palette: ['#fffaf0', '#c8bda8'], petalPalettes: [['#f2dfc4', '#d58f87', '#d9b55f'], ['#e9e5d5', '#a2a875', '#d58f87'], ['#f1cfc1', '#cf8d7d', '#e0bf6d']] },
    },
    P04: {
      originalPortrait: { type: 'portrait', finish: 'halftone', seed: 20261024, palette: ['#f4f0e7', '#222728', '#777a76'] },
      simulatedPortrait: { type: 'portrait', finish: 'pixel', seed: 20261024, palette: ['#f4f0e7', '#222728', '#777a76'] },
      fingerprint: { type: 'fingerprint', seed: 4047, palette: ['#f3eee3', '#354448', '#9a8a70'] },
    },
    P07: { fingerprint: { type: 'fingerprint', seed: 7041, palette: ['#f3eee3', '#354448', '#9a8a70'] } },
  } },
  { id: 'rose-lab', chapterId: 'model', palette: ['#e0a7b7', '#c97991', '#66545b'], material: '粉色地景、透明研究台、霧面資料裝置', motifs: ['觀察窗', '證據卡', '分岔路徑'], atmosphere: '先看見假設，再檢查證據與未知。', editorialMotifs: {
    M01: {
      originalPortrait: { type: 'portrait', finish: 'halftone', seed: 20261024, palette: ['#f4f0e7', '#222728', '#777a76'] },
      simulatedPortrait: { type: 'portrait', finish: 'pixel', seed: 20261024, palette: ['#f4f0e7', '#222728', '#777a76'] },
    },
  } },
  { id: 'blue-current', chapterId: 'ai', palette: ['#75c8c7', '#458b9c', '#364b60'], material: '青藍水域、服務街區、手作工坊', motifs: ['任務流', '服務窗口', '協作工具'], atmosphere: '理解要進入服務、內容和責任分工。', editorialMotifs: {
    A03: { flowerPaper: {
      type: 'flower-paper', seed: 9033, palette: ['#fffaf0', '#c8bda8'],
      petalPalettes: [
        ['#eee0c6', '#bd8d54', '#6f9490'],
        ['#e5d6df', '#a6799f', '#d8a678'],
        ['#dce7df', '#6f9e92', '#d5b45e'],
      ],
    } },
  } },
];

function cloneEditorialMotifs(editorialMotifs = {}) {
  return Object.fromEntries(Object.entries(editorialMotifs).map(([sceneId, motifs]) => [
    sceneId,
    Object.fromEntries(Object.entries(motifs).map(([motifId, motif]) => [motifId, {
      ...motif,
      palette: [...motif.palette],
      ...(motif.petalPalettes ? { petalPalettes: motif.petalPalettes.map((palette) => [...palette]) } : {}),
    }])),
  ]));
}

const CHARACTERS = [
  { id: 'achi', name: '阿綺', role: '品牌企劃人', nature: '反應快、行程滿，習慣先把事情整理成簡報；碰到互相矛盾的資訊時會皺眉停筆。', habit: '想事情時轉筆，說「等一下」後會先看證據。', motive: '想更快做出決定，也怕把錯誤答案帶進客戶會議。', fictional: true },
  { id: 'yue', name: '小岳', role: '消費者', nature: '喜歡新鮮事，對推薦常保留一點；會回頭比較，也承認自己有時就是偏愛某個選擇。', habit: '看到熟悉品牌會挑眉，拿起商品後常再看一次包裝。', motive: '希望選擇符合自己的情境，不想被一個「最划算」替自己決定。', fictional: true },
  { id: 'yingzhen', name: '映蓁', role: '研究者', nature: '講依據，也會把不知道的地方留白；模擬結果看起來再完整，她都想先翻到背面。', habit: '用鉛筆在數據旁畫記號，遇到單一來源會再找一個對照。', motive: '讓研究幫上決策，同時說清楚資料能回答到哪裡。', fictional: true },
  { id: 'fenjie', name: '芬姐', role: '服務現場工作者', nature: '先看人再看流程，知道顧客不一定會直接說出卡住的原因。', habit: '開口前先停一下看對方表情，說話不急。', motive: '讓人放心完成眼前的事，需要時有人能接手。', fictional: true },
];

const INTERACTIONS = [
  { id: 'sourceverification', kind: 'sourceverification', title: '真假查證', instruction: '挑一條先追查的線索，再看它能支持什麼結論。', inputType: 'single-select', outputFields: ['finding', 'evidenceLimit', 'insightTag'] },
  { id: 'purchase', kind: 'purchase', title: '購買選擇', instruction: '選出此刻最影響選擇的需要，觀察推薦與偏好如何分開。', inputType: 'single-select', outputFields: ['choice', 'tradeoff', 'insightTag'] },
  { id: 'attention', kind: 'attention', title: '注意力挑戰', instruction: '選一個投入程度，看看曝光、參與和記憶之間有何差別。', inputType: 'discrete-range', outputFields: ['attentionState', 'reflection', 'insightTag'] },
  { id: 'memory', kind: 'memory', title: '共同記憶探索', instruction: '找出場景裡讓人想起共同經驗的細節。', inputType: 'multi-select', outputFields: ['foundDetails', 'sharedContext', 'insightTag'] },
  { id: 'persona', kind: 'persona', title: 'Persona 觀察室', instruction: '改變一項情境，再檢查推論的適用範圍。', inputType: 'scenario-select', outputFields: ['scenario', 'modelBoundary', 'insightTag'] },
  { id: 'judgment', kind: 'judgment', title: '衡斷力分類', instruction: '選擇目前資料屬於哪一類，並保留尚未確定的部分。', inputType: 'evidence-classification', outputFields: ['classification', 'decisionUse', 'insightTag'] },
  { id: 'journey', kind: 'journey', title: '顧客旅程修復', instruction: '選出顧客停下來的節點，安排合適的下一步支援。', inputType: 'stage-select', outputFields: ['frictionPoint', 'supportAction', 'insightTag'] },
  { id: 'delegation', kind: 'delegation', title: 'Agent 協作工坊', instruction: '替任務選擇可委託的範圍，並標出人要確認的地方。', inputType: 'permission-select', outputFields: ['delegatedTask', 'humanCheckpoint', 'insightTag'] },
];

const SCENE_CATALOG = [
  {
    id: 'I01', chapterId: 'intro', protagonistId: 'achi',
    setting: '企劃工作室裡，會議簡報已經生成，桌上還留著一張未填完的價值檢查表。',
    lifeEvent: '阿綺收到一份很快完成的提案，客戶卻追問它替消費者解決了什麼。',
    coreDevice: { id: 'value-desk', label: '效率與價值工作台', description: '把省下的時間、消費者價值和需要人判斷的地方放在同一張桌面上。' },
    interactionType: 'judgment',
    interaction: { prompt: '如果提案只證明產出變快，下一個要補上的判斷是什麼？', control: { id: 'growth-claim', type: 'evidence-classification', label: '選一張桌上的判斷卡', minSelections: 1, maxSelections: 1, options: [{ id: 'speed', label: '先看製作速度', value: 'efficiency' }, { id: 'customer', label: '看是否替客戶創造價值', value: 'value' }, { id: 'risk', label: '先檢查資料與責任', value: 'governance' }] }, outcomes: [{ choiceId: 'speed', title: '速度是一項投入', text: '速度能縮短學習循環，但單靠產出更快，還不能說明市場價值。', insightTag: 'judgment', sourceHighlightIndex: 1 }, { choiceId: 'customer', title: '把問題拉回價值', text: '先問消費者是否得到更好的解決方式，才能分辨效率和成長。', insightTag: 'value', sourceHighlightIndex: 1 }, { choiceId: 'risk', title: '決策要有防線', text: '資料安全與人的判斷，是把 AI 速度用在經營上的必要條件。', insightTag: 'trust', sourceHighlightIndex: 2 }] },
    dialogue: [{ characterId: 'achi', text: '報告做得很快。可是客戶會因此得到什麼？', kind: 'fictional-dialogue' }, { characterId: 'yingzhen', text: '先把能證明的和還沒驗證的分開。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'concept-deepening', reason: '先從企業怎麼用 AI 學習與創造成長出發，再追問品牌變快之後如何真正理解人。', question: '如果答案來得更快，品牌和人的距離就會更近嗎？', visual: '工作台上的價值檢查表沿紙纖維展開，變成通往兩岸的連結裝置。' },
  },
  {
    id: 'I02', chapterId: 'intro', protagonistId: 'achi',
    setting: '兩岸之間有一座接觸頻率橋，橋面每亮起一次，就有一張尚未回答的理解問題浮現。',
    lifeEvent: '阿綺發現品牌訊息送達很多次，團隊卻不確定消費者是否被真正理解。',
    coreDevice: { id: 'distance-bridge', label: '接觸與理解連結裝置', description: '把接觸次數與理解深度分成兩條可比較的路徑。' },
    interactionType: 'sourceverification',
    interaction: { prompt: '品牌想確認自己是否理解人，先把哪一種證據帶上橋？', control: { id: 'understanding-evidence', type: 'single-select', label: '選擇先核對的依據', minSelections: 1, maxSelections: 1, options: [{ id: 'survey', label: '消費者調查與生活型態資料', value: 'research' }, { id: 'contact', label: '品牌接觸點的曝光紀錄', value: 'contact' }, { id: 'conversation', label: '換說法或情境後的持續對話', value: 'dialogue' }] }, outcomes: [{ choiceId: 'survey', title: '研究提供起點', text: '調查讓品牌有依據，但仍要看樣本和情境能否回答眼前問題。', insightTag: 'people', sourceHighlightIndex: 1 }, { choiceId: 'contact', title: '接觸不等於理解', text: '曝光紀錄說明訊息出現過，無法單獨證明消費者真的認同。', insightTag: 'trust', sourceHighlightIndex: 0 }, { choiceId: 'conversation', title: '把研究變成對話', text: '持續測試不同主張和情境，讓研究成為修正方向的循環。', insightTag: 'dialogue', sourceHighlightIndex: 1 }] },
    dialogue: [{ characterId: 'achi', text: '訊息傳得更遠了，我們真的更懂人嗎？', kind: 'fictional-dialogue' }, { characterId: 'yue', text: '你們先聽聽看我為什麼停下來吧。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'problem-cause', reason: '開場提出品牌與人的距離問題，接下來先進入 AI 真假難辨時的真實感與信任。', question: '看起來像真的內容，還需要什麼才能讓人相信？', visual: '橋邊一張未標來源的影像被海風吹起，印記逐漸變成花園裡可追查的線索。' },
  },
  {
    id: 'P01', chapterId: 'people', protagonistId: 'yingzhen',
    setting: '真實與合成影像交錯的花園裡，有些花的標籤指向原始來源，有些只留下漂亮的外觀。',
    lifeEvent: '映蓁拿到一張廣泛流傳的影像，發現圖片本身沒有說明從哪裡來。',
    coreDevice: { id: 'origin-garden', label: '影像來源花園', description: '逐一翻看素材來源、製作方式和可核對的佐證。' },
    interactionType: 'sourceverification',
    interaction: { prompt: '這張影像很有說服力。你會先追哪個來源線索？', control: { id: 'image-trail', type: 'single-select', label: '選一個查證起點', minSelections: 1, maxSelections: 1, options: [{ id: 'creator', label: '找原始發布者與拍攝脈絡', value: 'primary-source' }, { id: 'reverse', label: '比對不同版本與發布時間', value: 'cross-check' }, { id: 'label', label: '看平台提供的生成標記', value: 'disclosure' }] }, outcomes: [{ choiceId: 'creator', title: '回到第一手來源', text: '先找作品由誰、在何種情境製作，能避免只用外觀判斷真實。', insightTag: 'truth', sourceHighlightIndex: 1 }, { choiceId: 'reverse', title: '交叉比對脈絡', text: '多個版本可顯示影像如何被改動與傳播，但仍要回到來源核實。', insightTag: 'verification', sourceHighlightIndex: 0 }, { choiceId: 'label', title: '標記只是線索', text: '生成標記能補充脈絡，不能取代對內容和來源的查證。', insightTag: 'truth', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'yingzhen', text: '這張圖很真，但我還沒找到它從哪裡來。', kind: 'fictional-dialogue' }, { characterId: 'fenjie', text: '那我們先別急著轉給下一個人。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'practical-application', reason: '真實感需要可核對的來源，接下來看品牌如何把真實感、信任與文化參與接成成長方法。', question: '品牌要怎麼同時被 AI 理解、被人信任，也進入文化？', visual: '花園裡的來源標記分成三條小徑，分別通往算法、人心與文化街區。' },
  },
  {
    id: 'P02', chapterId: 'people', protagonistId: 'fenjie',
    setting: '商業街區裡，需求、體驗與行動分布在不同街口，居民要走過才知道下一步。',
    lifeEvent: '芬姐接待一位被多個推薦選項包圍的顧客，先問她現在要完成什麼。',
    coreDevice: { id: 'growth-street', label: '增長三角街區', description: '用演算法、人心和文化三個入口串起需求到行動。' },
    interactionType: 'journey',
    interaction: { prompt: '顧客走到街口卻沒有下一步，先把哪一段接好？', control: { id: 'growth-path', type: 'stage-select', label: '選一個先修復的街口', minSelections: 1, maxSelections: 1, options: [{ id: 'discover', label: '讓合適的人看見並理解品牌', value: 'discovery' }, { id: 'trust', label: '補上信任與情緒連結', value: 'trust' }, { id: 'culture', label: '讓顧客能參與文化情境', value: 'culture' }] }, outcomes: [{ choiceId: 'discover', title: '入口要被讀懂', text: 'AI 能讀取內容，才有機會把品牌放進相關的消費情境。', insightTag: 'growth', sourceHighlightIndex: 0 }, { choiceId: 'trust', title: '推薦不會自動產生偏好', text: '信任和情感連結需要長期投入，不能只靠演算法排序。', insightTag: 'trust', sourceHighlightIndex: 0 }, { choiceId: 'culture', title: '加入正在發生的文化', text: '娛樂、運動和 IP 能讓品牌被參與，而不只是被看到。', insightTag: 'culture', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'fenjie', text: '先跟我說，你現在最想完成哪一件事。', kind: 'fictional-dialogue' }, { characterId: 'yue', text: '我想看懂選項，不想再多一排推薦。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'concept-deepening', reason: '增長街區分出多個需要協作的入口，策略角色要先判斷真正的成長課題再安排工作。', question: '看起來是轉換不佳，背後真正卡住的是哪個問題？', visual: '街區路線收束成一張立體策略工作台，分散的路口接成完整旅程。' },
  },
  {
    id: 'P03', chapterId: 'people', protagonistId: 'achi',
    setting: '立體策略工作台上，同一張問題卡可以連到品牌定位、需求、內容和服務。',
    lifeEvent: '阿綺把一份「年輕客群不買單」的簡報翻過來，發現背後還有幾個未定義的原因。',
    coreDevice: { id: 'growth-blueprint', label: '增長架構工作台', description: '把表面指標接回品牌、人性洞察、文化和可執行任務。' },
    interactionType: 'journey',
    interaction: { prompt: '先把表面症狀連回一個更可能的成長課題。', control: { id: 'strategy-question', type: 'stage-select', label: '選擇要先釐清的環節', minSelections: 1, maxSelections: 1, options: [{ id: 'positioning', label: '品牌定位是否清楚', value: 'positioning' }, { id: 'value', label: '消費者是否信任產品價值', value: 'value' }, { id: 'culture', label: '品牌是否進入對方的文化語境', value: 'culture' }] }, outcomes: [{ choiceId: 'positioning', title: '先釐清品牌說什麼', text: '如果定位不清楚，增加廣告聲量也不一定能補上品牌認知。', insightTag: 'strategy', sourceHighlightIndex: 0 }, { choiceId: 'value', title: '先問為何值得選', text: '轉換不佳可能是價值未被理解或信任不足，需回到消費者問題。', insightTag: 'trust', sourceHighlightIndex: 0 }, { choiceId: 'culture', title: '先進入生活脈絡', text: '年輕族群不買單可能表示品牌還沒有合適的文化連結方式。', insightTag: 'culture', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'achi', text: '「年輕人不買」聽起來像結論，其實還是問題。', kind: 'fictional-dialogue' }, { characterId: 'yingzhen', text: '先拆清楚，我們才知道要驗證什麼。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'problem-cause', reason: '策略架構需要真實的人性洞察，下一座島檢查信任如何由可查證的證據建立。', question: '我們說自己可靠，消費者能在哪裡看到證據？', visual: '工作台上的連線拉長成一道透明橋，桌面卡片轉成查證室的來源檔案。' },
  },
  {
    id: 'P04', chapterId: 'people', protagonistId: 'yingzhen',
    setting: '信任橋連著新聞查證室，桌面上擺著來源紀錄、不同說法和一張暫緩刊出的稿件。',
    lifeEvent: '映蓁遇到一份說法完整的材料，但交叉比對後仍找不到足以支持結論的來源。',
    coreDevice: { id: 'trust-bridge', label: '證據與信任橋', description: '把來源數量、相互印證和仍待查明的部分分開呈現。' },
    interactionType: 'sourceverification',
    interaction: { prompt: '兩份材料都說得通，哪一步能讓信任多一點依據？', control: { id: 'trust-check', type: 'single-select', label: '選擇查證動作', minSelections: 1, maxSelections: 1, options: [{ id: 'three-sources', label: '尋找不同來源交叉驗證', value: 'cross-source' }, { id: 'counterparty', label: '補上當事人與競爭者說法', value: 'counter-view' }, { id: 'hold', label: '目前證據不足，暫緩定論', value: 'hold' }] }, outcomes: [{ choiceId: 'three-sources', title: '多來源互相核對', text: '交叉驗證能降低單一說法帶來的風險，仍需核對來源是否彼此獨立。', insightTag: 'trust', sourceHighlightIndex: 0 }, { choiceId: 'counterparty', title: '讓不同立場入場', text: '當事方與競爭者的說法可補足脈絡，不能只留下最有利的一方。', insightTag: 'verification', sourceHighlightIndex: 0 }, { choiceId: 'hold', title: '不刊出也是判斷', text: '無法驗證時暫緩發表，保住內容的可信度。', insightTag: 'judgment', sourceHighlightIndex: 1 }] },
    dialogue: [{ characterId: 'yingzhen', text: '這份資料還缺一個能互相核對的來源。', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '那先別把猜測放進簡報結論。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'different-viewpoint', reason: '信任來自可被理解的證據，接下來看品牌如何在理性推薦之外形成真實購買動機。', question: 'AI 找到划算的選項後，人為什麼還會想要另一個？', visual: '透明橋上的來源印記化成店門口的商品標籤，一張購物清單被風吹向情境商店。' },
  },
  {
    id: 'P05', chapterId: 'people', protagonistId: 'yue',
    setting: '情境商店把價格、用途和品牌故事放在不同貨架，小岳拿著推薦清單又回頭看一款熟悉商品。',
    lifeEvent: '小岳看到 Agent 推出的高性價比選項，卻仍記得另一個品牌陪過自己的某段生活。',
    coreDevice: { id: 'desire-shelf', label: '偏愛與偏心選擇架', description: '讓理性條件、當下需求和情緒價值同時被看見。' },
    interactionType: 'purchase',
    interaction: { prompt: '先選一項真正影響你此刻想買什麼的理由。', control: { id: 'purchase-motive', type: 'single-select', label: '選一個此刻最重要的條件', minSelections: 1, maxSelections: 1, options: [{ id: 'value', label: '功能、價格和合用程度', value: 'rational-fit' }, { id: 'emotion', label: '和品牌故事或生活經驗的連結', value: 'emotional-fit' }, { id: 'context', label: '現在的情境與能否馬上取得', value: 'occasion-fit' }] }, outcomes: [{ choiceId: 'value', title: '理性選擇有它的理由', text: '推薦可快速比較價格和功能，但它不一定包含消費者所有在意的事。', insightTag: 'preference', sourceHighlightIndex: 1 }, { choiceId: 'emotion', title: '偏心來自情感慣性', text: '沒有簡單規格能完整說明的喜歡，可能來自故事、認同和熟悉感。', insightTag: 'affinity', sourceHighlightIndex: 0 }, { choiceId: 'context', title: '選擇發生在情境裡', text: '使用場景決定商品是否合適，品牌要在比較發生前被想起。', insightTag: 'journey', sourceHighlightIndex: 1 }] },
    dialogue: [{ characterId: 'yue', text: '推薦的確實划算，可是我今天想買的不是那個。', kind: 'fictional-dialogue' }, { characterId: 'fenjie', text: '你在意它哪一點？我們可以從這裡開始。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'concept-deepening', reason: '購買動機不只來自功能和價格，品牌也透過共同參與與情緒記憶進入生活。', question: '什麼樣的體驗會讓人過一陣子還記得？', visual: '商品袋上的情緒標籤延伸成一束舞台燈光，照亮體育場和演唱會的入口。' },
  },
  {
    id: 'P06', chapterId: 'people', protagonistId: 'yue',
    setting: '小型體育場和演唱會共用一片草地，入場的人正在交換應援物和剛拍下的照片。',
    lifeEvent: '小岳本來只打算路過，聽見熟悉的歌後停下來，和一群人一起唱完副歌。',
    coreDevice: { id: 'shared-stage', label: '共同參與舞台', description: '把聲音、入場、應援和可帶走的記憶線索放在一起。' },
    interactionType: 'memory',
    interaction: { prompt: '挑出會讓你想起這場共同參與的細節。', control: { id: 'shared-moment', type: 'multi-select', label: '選取最有記憶的現場線索', minSelections: 1, maxSelections: 3, options: [{ id: 'song', label: '大家一起唱的那一段', value: 'shared-song' }, { id: 'cheer', label: '和旁邊的人交換應援', value: 'participation' }, { id: 'place', label: '球場或舞台的共同場景', value: 'place' }, { id: 'story', label: '能說給朋友聽的故事', value: 'story' }] }, outcomes: [{ choiceId: 'song', title: '聲音成為共同線索', text: '共同聽見同一段內容，可能讓不同人找到相聚的時刻。', insightTag: 'memory', sourceHighlightIndex: 0 }, { choiceId: 'cheer', title: '參與讓關係可見', text: '粉絲不只是觀看者，應援和二創也讓人能加入文化現場。', insightTag: 'participation', sourceHighlightIndex: 1 }, { choiceId: 'place', title: '場域承接共同經驗', text: '體育與娛樂提供品牌和人能夠相遇的實際場景。', insightTag: 'culture', sourceHighlightIndex: 1 }, { choiceId: 'story', title: '記憶會被轉述', text: '能被人帶回日常分享的經驗，可能比單次曝光留下更久。', insightTag: 'attention', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'yue', text: '我本來只是經過，現在想把這段唱完。', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '這個時刻，好像比看見一次廣告更容易記住。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'practical-application', reason: '現場體驗說明注意力和參與會留下印象，接下來檢查演算法偏好的內容是否也能打動人。', question: '內容被排序看見之後，誰會願意替品牌說話？', visual: '舞台燈光化成手機留言上的一個光點，沿著社群巷弄滑向真實對話。' },
  },
  {
    id: 'P07', chapterId: 'people', protagonistId: 'yue',
    setting: '社群巷弄裡，公告牆貼著品牌文案、使用者經驗和幾段互相追問的留言。',
    lifeEvent: '小岳發現一則產品說明寫得完整，朋友卻更相信另一位使用者具體說明怎麼使用。',
    coreDevice: { id: 'conversation-alley', label: '真實對話牆', description: '同時查看可擷取的資訊和人願意分享的使用經驗。' },
    interactionType: 'sourceverification',
    interaction: { prompt: '一段討論被 AI 引用時，你要先看什麼？', control: { id: 'social-proof', type: 'single-select', label: '選擇核對的對話線索', minSelections: 1, maxSelections: 1, options: [{ id: 'detail', label: '是否有具體使用情境', value: 'experience' }, { id: 'source', label: '留言者能否被辨認為真實經驗者', value: 'authenticity' }, { id: 'balance', label: '是否包含限制與不同看法', value: 'balance' }] }, outcomes: [{ choiceId: 'detail', title: '經驗要說得具體', text: '具體情境讓資訊較容易被理解和擷取，也讓人知道分享者遇到什麼。', insightTag: 'content', sourceHighlightIndex: 1 }, { choiceId: 'source', title: '真實討論建立脈絡', text: '自發且具體的討論能提供品牌內容以外的參考，但不能只看數量。', insightTag: 'trust', sourceHighlightIndex: 0 }, { choiceId: 'balance', title: '資訊與情緒都要在場', text: '只有規格或只有情緒都不夠，品牌要守住可理解資訊和共鳴的交集。', insightTag: 'judgment', sourceHighlightIndex: 1 }] },
    dialogue: [{ characterId: 'yue', text: '這個介紹很完整，但朋友那段比較像真的用過。', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '那我們得讓資訊說清楚，也讓人有話可說。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'concept-deepening', reason: '社群討論需要真實參與與具體感受，媒體也可以從購買曝光改為設計可參與的注意力。', question: '被看見之後，人有沒有真的投入一段時間？', visual: '留言裡的觀看時間刻度沿牆延伸，變成一條可以走進去的媒體街。' },
  },
  {
    id: 'P08', chapterId: 'people', protagonistId: 'achi',
    setting: '街頭媒體場域裡，兩個看板輪播相同訊息，一旁的體驗攤位則等著有人停下來。',
    lifeEvent: '阿綺發現畫面曝光都達標，但真正停留和回想的人不多。',
    coreDevice: { id: 'attention-meter', label: '曝光與注意力計時器', description: '比較可視曝光、觀看秒數、主動參與和記憶線索。' },
    interactionType: 'attention',
    interaction: { prompt: '選一種觀看狀態，想想它能留下多少注意力證據。', control: { id: 'attention-level', type: 'discrete-range', label: '選一段投入程度', minSelections: 1, maxSelections: 1, options: [{ id: 'glance', label: '瞥見一下', value: 2 }, { id: 'watch', label: '停留觀看', value: 5 }, { id: 'join', label: '停下來參與', value: 8 }] }, outcomes: [{ choiceId: 'glance', title: '可視不代表被看進去', text: '畫面存在只是曝光，不能據此推定品牌已被記住。', insightTag: 'attention', sourceHighlightIndex: 0 }, { choiceId: 'watch', title: '觀看時間值得觀察', text: '研究指出平均觀看秒數比單看可視率更能預測品牌回想。', insightTag: 'memory', sourceHighlightIndex: 0 }, { choiceId: 'join', title: '參與留下可比較的經驗', text: '把媒體做成體驗，能讓人主動投入並形成記憶線索。', insightTag: 'participation', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'achi', text: '報表說大家都看見了，怎麼還是記不住？', kind: 'fictional-dialogue' }, { characterId: 'yue', text: '我真的停下來的那一刻，才會想回頭找你。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'concept-deepening', reason: '注意力能讓品牌被感受到，下一座島追問哪些共看與共參與能在分眾時代留下共同記憶。', question: '大家一起記得的時刻，是怎麼形成的？', visual: '計時器的觀看刻度點亮成一座舊劇場的座位，空白座位逐漸坐滿共同記憶。' },
  },
  {
    id: 'P09', chapterId: 'people', protagonistId: 'yue',
    setting: '懷舊劇場和共看廣場裡，觀眾交換金曲、戲劇和運動賽事帶來的生活記憶。',
    lifeEvent: '小岳聽見廣場有人談起一首舊歌，才發現不同世代都記得那段旋律。',
    coreDevice: { id: 'common-ground-stage', label: '共同記憶收集台', description: '把一起看、一起聽和願意重述的生活細節排成場景。' },
    interactionType: 'memory',
    interaction: { prompt: '挑出能讓不同人相遇的共同觀看線索。', control: { id: 'common-ground', type: 'multi-select', label: '收集共同記憶線索', minSelections: 1, maxSelections: 3, options: [{ id: 'music', label: '不同人都聽過的歌曲', value: 'music' }, { id: 'show', label: '一起追過的節目或戲劇', value: 'shared-show' }, { id: 'sport', label: '同一場賽事的現場時刻', value: 'sport' }, { id: 'talk', label: '把回憶說給別人聽', value: 'retelling' }] }, outcomes: [{ choiceId: 'music', title: '旋律讓人接上記憶', text: '共通內容可以跨過部分年齡與生活差異，成為品牌相聚的入口。', insightTag: 'memory', sourceHighlightIndex: 0 }, { choiceId: 'show', title: '共同觀看搭起橋梁', text: '收視和內容情境提供人與品牌共同經歷的場域。', insightTag: 'culture', sourceHighlightIndex: 0 }, { choiceId: 'sport', title: '現場感讓參與延伸', text: '賽事觀眾的共同情緒能延續成長期的討論和品牌關係。', insightTag: 'participation', sourceHighlightIndex: 1 }, { choiceId: 'talk', title: '轉述讓記憶繼續', text: '人願意分享的片段，讓共同經驗有機會持續被記起。', insightTag: 'trust', sourceHighlightIndex: 1 }] },
    dialogue: [{ characterId: 'yue', text: '我沒看過這一集，怎麼也跟得上大家在笑什麼？', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '原來品牌也需要一個大家能相遇的地方。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'research-validation', reason: '共同記憶提供理解人的線索，接下來研究者把這些問題帶進可對話的消費者模型。', question: '品牌能不能在真正決策之前，先和消費者對話？', visual: '劇場裡的座位逐漸排成觀察室的訪談椅，掌聲聲波變成模型上的情境資料。' },
  },
  {
    id: 'M01', chapterId: 'model', protagonistId: 'yingzhen',
    setting: '消費者觀察室中，產品情境卡排成可切換的對話位置，模型結果卡還有一面未翻開。',
    lifeEvent: '映蓁跑完一次 Persona 模擬，結果看起來合理，但她先把樣本與情境放在桌邊。',
    coreDevice: { id: 'persona-observation-room', label: 'Persona 情境觀察台', description: '更換需求和使用情境，觀察模擬能支持哪些假設。' },
    interactionType: 'persona',
    interaction: { prompt: '換一個情境，檢查模型推論是否還成立。', control: { id: 'persona-scenario', type: 'scenario-select', label: '選一個要測的情境', minSelections: 1, maxSelections: 1, options: [{ id: 'new-category', label: '從未出現過的新產品類別', value: 'novelty' }, { id: 'known-market', label: '既有品類中的包裝選擇', value: 'known-choice' }, { id: 'social-shift', label: '社會情緒突然改變', value: 'rapid-change' }] }, outcomes: [{ choiceId: 'new-category', title: '新類別需要更多校準', text: '沒有足夠先例時，模擬應由真人研究補上尚未觀察到的反應。', insightTag: 'model-boundary', sourceHighlightIndex: 1 }, { choiceId: 'known-market', title: '熟悉情境可先驗證', text: '已有研究基礎時，模型可協助比較產品、價格、包裝和溝通方向。', insightTag: 'simulation', sourceHighlightIndex: 2 }, { choiceId: 'social-shift', title: '態度變化要留意時點', text: '市場與情緒快速轉變時，既有樣本不一定足以代表新的狀態。', insightTag: 'judgment', sourceHighlightIndex: 1 }] },
    dialogue: [{ characterId: 'yingzhen', text: '0.89 是一個訊號，不是可以忘記邊界的理由。', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '那張結果卡背面寫了什麼？', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'practical-application', reason: 'Persona 模擬需清楚說明樣本和情境，下一步把有限注意力放回品牌會出現的關鍵場域。', question: '有限的注意力應該放在哪些地方，才不會被稀釋？', visual: '觀察室的情境卡展開成多渠道地圖，散落的接觸點被連成一條選擇路徑。' },
  },
  {
    id: 'M02', chapterId: 'model', protagonistId: 'achi',
    setting: '多渠道選擇地圖把影音、搜尋、社群和實體體驗放在不同地勢，品牌光點不會平均分布。',
    lifeEvent: '阿綺發現一張聲量報表涵蓋很多渠道，卻沒有指出消費者在哪裡真正注意到品牌。',
    coreDevice: { id: 'sov-map', label: '關鍵場域選擇地圖', description: '比較接觸點的注意力品質、品牌需求與文化情境。' },
    interactionType: 'attention',
    interaction: { prompt: '選出一個最值得進一步驗證的媒體場域。', control: { id: 'channel-focus', type: 'discrete-range', label: '選擇要先看的場域', minSelections: 1, maxSelections: 1, options: [{ id: 'video', label: '能累積較長觀看的影音場域', value: 3 }, { id: 'search', label: '消費者主動找答案的搜尋場域', value: 6 }, { id: 'experience', label: '能親自參與的實體體驗場域', value: 9 }] }, outcomes: [{ choiceId: 'video', title: '先檢查觀看品質', text: '影片曝光要和觀看秒數一起看，才能了解人是否有投入。', insightTag: 'attention', sourceHighlightIndex: 0 }, { choiceId: 'search', title: '守住被選擇的入口', text: '注意力被分散時，品牌仍要在消費者主動決策的場域保持可見。', insightTag: 'sov', sourceHighlightIndex: 0 }, { choiceId: 'experience', title: '場域可以承載參與', text: 'SOV 要連到消費者參與的關鍵場域，而不只是增加觸及點。', insightTag: 'participation', sourceHighlightIndex: 1 }] },
    dialogue: [{ characterId: 'achi', text: '這張地圖上有很多點，哪幾個是人真的會停留的？', kind: 'fictional-dialogue' }, { characterId: 'yingzhen', text: '先定義要觀察什麼，再決定怎麼比較。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'research-validation', reason: '媒體場域的取捨需要可比較的依據，接下來辨認哪些數據能支撐決策，哪些仍只是估計。', question: '看起來完整的資料，能直接替我們下決定嗎？', visual: '地圖上各渠道的標記變成天平上的不同證據卡，海岸另一端出現決策桌。' },
  },
  {
    id: 'M03', chapterId: 'model', protagonistId: 'yingzhen',
    setting: '證據天平旁有資料、估計、推論與未知四個托盤，研究者正等候有人把結果卡翻面。',
    lifeEvent: '映蓁看見一組精確到小數點的預測，發現它背後有幾個假設還沒被標出來。',
    coreDevice: { id: 'judgment-balance', label: '證據分類與決策桌', description: '把觀察到的資料、估計、推論和未知放進不同位置。' },
    interactionType: 'judgment',
    interaction: { prompt: '替眼前的陳述選一個最合適的分類。', control: { id: 'evidence-type', type: 'evidence-classification', label: '選擇你目前會採用的標籤', minSelections: 1, maxSelections: 1, options: [{ id: 'observed', label: '資料中直接觀察到', value: 'data' }, { id: 'estimated', label: '根據模型估計', value: 'estimate' }, { id: 'unknown', label: '現有資訊還無法回答', value: 'unknown' }] }, outcomes: [{ choiceId: 'observed', title: '直接資料可被核對', text: '先標出實際觀察到的內容，避免和模型推估混在一起。', insightTag: 'evidence', sourceHighlightIndex: 0 }, { choiceId: 'estimated', title: '估計仍是估計', text: '模型結果可協助判斷，但要保留假設、樣本與可能偏差。', insightTag: 'judgment', sourceHighlightIndex: 1 }, { choiceId: 'unknown', title: '未知也要有位置', text: '把無法回答的問題明確留下，能讓人知道下一步該補什麼。', insightTag: 'unknown', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'yingzhen', text: '數字很精確，先別把它當成真相。', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '我把不確定的部分也帶進決策會議。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'practical-application', reason: '衡斷力負責區分證據與未知，下一步要看怎麼把資料用在顧客真正需要完成的事。', question: '從一份報告到顧客下一步，中間還缺少什麼？', visual: '天平旁的未知卡變成服務路徑上的岔口，通往生成式體驗的下一步地圖。' },
  },
  {
    id: 'M04', chapterId: 'model', protagonistId: 'fenjie',
    setting: '服務路徑在每個決策點分岔，顧客可以看比較、問問題，或讓系統協助完成下一步。',
    lifeEvent: '芬姐發現顧客不缺商品推薦，她真正猶豫的是流程太長、限制又藏得很深。',
    coreDevice: { id: 'decision-map', label: '顧客下一步決策地圖', description: '找出猶豫節點，並把情境、資訊和服務支援接起來。' },
    interactionType: 'journey',
    interaction: { prompt: '顧客停下來時，選一個最能解除眼前阻力的行動。', control: { id: 'next-step', type: 'stage-select', label: '選一個支援動作', minSelections: 1, maxSelections: 1, options: [{ id: 'compare', label: '把差異和限制說清楚', value: 'clarify' }, { id: 'simplify', label: '減少現在不需要的步驟', value: 'simplify' }, { id: 'assist', label: '提供真人或 Agent 協助', value: 'assist' }] }, outcomes: [{ choiceId: 'compare', title: '補上決策資訊', text: '商品資料要說明適用情境、問題、差異和購買後限制。', insightTag: 'content', sourceHighlightIndex: 1 }, { choiceId: 'simplify', title: '移除不必要的摩擦', text: '過長或複雜的流程可能讓顧客放棄，縮短路徑要一起檢查風險。', insightTag: 'journey', sourceHighlightIndex: 0 }, { choiceId: 'assist', title: '看情境安排協助', text: '生成式體驗應支援顧客的下一步，不只是在頁面上增加 AI 功能。', insightTag: 'experience', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'fenjie', text: '他不是不要買，他只是還沒準備好往下走。', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '那就先把他卡住的地方找出來。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'problem-cause', reason: '個人旅程需要合適的資料和服務，企業也必須處理看不見的文化阻力才能把體驗落地。', question: '流程畫得很完整，為什麼組織還是走不動？', visual: '路徑下方浮出水面以下的冰山，服務路線與隱藏的文化暗流相接。' },
  },
  {
    id: 'M05', chapterId: 'model', protagonistId: 'fenjie',
    setting: '水面上是明亮的 AI 工具採購清單，水面下有尚未說出的擔心、部門界線和工作方式。',
    lifeEvent: '芬姐聽見同事說系統已經上線，但每個人仍不確定節省的時間該用來做什麼。',
    coreDevice: { id: 'culture-iceberg', label: '文化暗流冰山', description: '同時檢視可見工具、人的顧慮、主管訊號和跨部門阻力。' },
    interactionType: 'judgment',
    interaction: { prompt: '選一個應該先被看見的水面下因素。', control: { id: 'hidden-current', type: 'evidence-classification', label: '選擇一張需要聆聽的卡', minSelections: 1, maxSelections: 1, options: [{ id: 'fear', label: '員工對工作改變的擔心', value: 'employee-concern' }, { id: 'guidance', label: '主管沒有說明省下時間的用途', value: 'leadership-gap' }, { id: 'silo', label: '跨部門資訊和責任分散', value: 'silo' }] }, outcomes: [{ choiceId: 'fear', title: '把擔心說出來', text: '員工對角色變化的感受會影響轉型是否被採用。', insightTag: 'culture', sourceHighlightIndex: 0 }, { choiceId: 'guidance', title: '補上清楚的工作方向', text: '工具省下時間後，組織仍要說明接下來要如何使用。', insightTag: 'leadership', sourceHighlightIndex: 1 }, { choiceId: 'silo', title: '看見交接處的阻力', text: '部門之間資訊分散，可能讓單一工具無法改變決策流程。', insightTag: 'organization', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'fenjie', text: '工具是裝好了，可是大家好像還在等一句話。', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '那我們先問清楚，改變對每個人意味著什麼。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'practical-application', reason: '文化暗流提醒企業不能只看系統能力，接下來把注意力帶回服務現場的猶豫與治理指標。', question: '顧客卡住的地方，從哪一個訊號才看得出來？', visual: '冰山水面下的阻力化成服務街上短暫停住的腳步和一個未完成的表單。' },
  },
  {
    id: 'A01', chapterId: 'ai', protagonistId: 'fenjie',
    setting: '服務體驗街上，結帳頁面變短了，客服桌旁卻堆起更多需要補件的單據。',
    lifeEvent: '芬姐看到顧客很快完成下單，兩週後卻帶著混亂的配送問題回到服務窗口。',
    coreDevice: { id: 'service-friction-board', label: '猶豫與治理檢查板', description: '同時檢視轉換率、退款、取消、客服量和配送問題。' },
    interactionType: 'journey',
    interaction: { prompt: '轉換提升但後續問題變多，先在哪個節點增加支援？', control: { id: 'service-repair', type: 'stage-select', label: '選一個先調整的服務節點', minSelections: 1, maxSelections: 1, options: [{ id: 'before-pay', label: '結帳前說清楚必要資訊', value: 'checkout' }, { id: 'after-order', label: '下單後補上配送與退貨說明', value: 'fulfillment' }, { id: 'support', label: '讓顧客容易找到客服協助', value: 'support' }] }, outcomes: [{ choiceId: 'before-pay', title: '先讓顧客知道代價', text: '縮短流程時仍要讓付款、商品和風險資訊足以支持選擇。', insightTag: 'journey', sourceHighlightIndex: 0 }, { choiceId: 'after-order', title: '檢查完整服務結果', text: '轉換率要和退款、取消、配送錯誤及客服量一起看。', insightTag: 'governance', sourceHighlightIndex: 0 }, { choiceId: 'support', title: '保留能接手的窗口', text: '當流程或商品不符合預期，顧客需要明確而可用的協助。', insightTag: 'service', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'fenjie', text: '他下單很快，現在卻不知道該問誰。', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '只看轉換率，我們會漏掉後面發生的事。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'concept-deepening', reason: '服務設計必須納入治理和支援，AI Agent 也需要回答它正在做什麼、使用哪些資料。', question: '顧客看不見 Agent 的工作過程，怎麼放心把任務交出去？', visual: '服務窗口上的待辦單被接進一個協作中心，Agent 的每個步驟都留下可確認的狀態。' },
  },
  {
    id: 'A02', chapterId: 'ai', protagonistId: 'achi',
    setting: '人與 Agent 協作中心的任務牆上，每件工作都標有資料狀態、執行進度與人工確認位置。',
    lifeEvent: '阿綺看到 Agent 很快整理完客戶資料，使用者卻不知道它漏了哪個帳戶或用了哪個版本。',
    coreDevice: { id: 'agent-transparency-desk', label: '任務透明與信任面板', description: '顯示 Agent 的資料來源、執行狀態、限制和人工接手點。' },
    interactionType: 'delegation',
    interaction: { prompt: '替這項任務選一個委託邊界，並標出人工檢查點。', control: { id: 'agent-trust-boundary', type: 'permission-select', label: '選擇 Agent 的可執行範圍', minSelections: 1, maxSelections: 1, options: [{ id: 'draft', label: '整理資料並提出草稿', value: 'draft-only' }, { id: 'recommend', label: '比較方案並提出建議', value: 'recommend' }, { id: 'execute', label: '直接完成且不回報進度', value: 'execute' }] }, outcomes: [{ choiceId: 'draft', title: '先讓人看得見工作', text: 'Agent 可以整理資料，並公開來源與待確認項目。', insightTag: 'transparency', sourceHighlightIndex: 0 }, { choiceId: 'recommend', title: '建議需要可檢查依據', text: 'AI 能協助判斷，使用者仍需知道依據、限制和建議如何形成。', insightTag: 'trust', sourceHighlightIndex: 0 }, { choiceId: 'execute', title: '不透明會傷害使用信任', text: '任務執行快不代表值得託付，狀態和接手方式也屬於體驗。', insightTag: 'human-checkpoint', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'achi', text: '它做完了，但我不知道它到底檢查過什麼。', kind: 'fictional-dialogue' }, { characterId: 'yingzhen', text: '把資料來源和限制一起顯示，才知道能不能接著用。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'different-viewpoint', reason: '可信任的 Agent 需要透明呈現工作和限制，品牌還要讓自己的內容被 AI 正確理解並被消費者記得。', question: '被 AI 引用之後，品牌留下了什麼？', visual: '任務牆上的內容卡變成答案花園裡的知識節點，卡片背面浮出情緒與品牌線索。' },
  },
  {
    id: 'A03', chapterId: 'ai', protagonistId: 'yue',
    setting: '答案花園裡，每種植物都能被 AI 讀取，但有些標籤寫得正確卻沒有任何鮮明記憶。',
    lifeEvent: '小岳從 AI 答案看見幾個相似品牌，離開頁面後卻想不起剛才哪個最有特色。',
    coreDevice: { id: 'knowledge-garden', label: '答案與品牌記憶圖譜', description: '同時檢查內容是否可被理解，以及品牌是否留下獨特印象。' },
    interactionType: 'sourceverification',
    interaction: { prompt: '選一個可以檢查答案品質，也能保留品牌辨識的方法。', control: { id: 'geo-check', type: 'single-select', label: '選擇檢查方向', minSelections: 1, maxSelections: 1, options: [{ id: 'facts', label: '提供清楚、可核對的內容來源', value: 'grounding' }, { id: 'voice', label: '加入品牌獨有的觀點與語氣', value: 'distinctiveness' }, { id: 'experience', label: '核對宣稱與實際體驗是否一致', value: 'experience' }] }, outcomes: [{ choiceId: 'facts', title: '先讓資訊能被理解', text: '結構清楚和可信來源能提高內容被正確讀取的機會。', insightTag: 'geo', sourceHighlightIndex: 0 }, { choiceId: 'voice', title: '不要只留下標準答案', text: '只有規格和公版敘述，可能讓品牌在同類答案中失去辨識。', insightTag: 'brand-memory', sourceHighlightIndex: 0 }, { choiceId: 'experience', title: '答案要對得上真實使用', text: '內容若和實際商品或服務有落差，快速引用反而會放大失望。', insightTag: 'trust', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'yue', text: '答案裡每個品牌都對，我還是不知道要記得誰。', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '讓人記得的那一點，不能也被整理掉。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'practical-application', reason: 'GEO 讓品牌更容易被 AI 看見，接著要把來源、情緒和品牌觀點轉成能通過治理的創意內容。', question: '怎麼讓大量素材既可用，又保留品牌自己的聲音？', visual: '知識圖譜的節點被整理成一串素材規格，排列成創意工坊的工作台。' },
  },
  {
    id: 'A04', chapterId: 'ai', protagonistId: 'achi',
    setting: '品牌創意工坊把提示、素材規格、品牌規範和檢查清單分開放，並保留最後的人工檢視席。',
    lifeEvent: '阿綺收到一批外表完整的生成素材，卻發現其中幾張不符合品牌語氣和使用情境。',
    coreDevice: { id: 'creative-quality-bench', label: '素材品質檢查台', description: '逐項檢查輸出規格、來源、品牌一致性和最後核准人。' },
    interactionType: 'judgment',
    interaction: { prompt: '選出產出前最需要補上的品質檢查。', control: { id: 'creative-qc', type: 'evidence-classification', label: '選擇一項檢查規則', minSelections: 1, maxSelections: 1, options: [{ id: 'brief', label: '素材是否符合任務規格', value: 'specification' }, { id: 'brand', label: '觀點與品牌規範是否一致', value: 'brand-fit' }, { id: 'reviewer', label: '是否有人確認來源和最終版本', value: 'review' }] }, outcomes: [{ choiceId: 'brief', title: '先定義交付規格', text: '可重複的素材產線需要明確規格，不能只靠一句提示期待一致結果。', insightTag: 'quality', sourceHighlightIndex: 0 }, { choiceId: 'brand', title: '保留品牌營養', text: '觀點、個性與文化脈絡能避免產量增加時逐漸滑向平均值。', insightTag: 'brand', sourceHighlightIndex: 0 }, { choiceId: 'reviewer', title: '把檢驗放進流程', text: '生成力需要治理與品質檢查，才能轉成穩定交付。', insightTag: 'governance', sourceHighlightIndex: 1 }] },
    dialogue: [{ characterId: 'achi', text: '素材很多，但其中有幾張不像我們會說的話。', kind: 'fictional-dialogue' }, { characterId: 'yingzhen', text: '先把標準寫清楚，再讓人檢查例外。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'concept-deepening', reason: '素材標準要落在明確流程與品質責任，下一步觀察人和 AI 如何組成可交付的創意代理商。', question: '規則和工具之外，什麼工作仍需要人來完成？', visual: '檢查清單的筆跡延伸成不同專業的工位，走進人與 AI 共用的協作工作室。' },
  },
  {
    id: 'A05', chapterId: 'ai', protagonistId: 'achi',
    setting: '協作工作室裡，創意、在地文化、生成工具和後期製作各有工作桌，任務流在其間來回。',
    lifeEvent: '阿綺看到一個跨市場素材任務，團隊需要同時保留在地特色和品牌一致性。',
    coreDevice: { id: 'production-workflow', label: '人與 AI 製作流程台', description: '把重複產製、創意判斷、在地文化和核准責任放在同一流程。' },
    interactionType: 'delegation',
    interaction: { prompt: '挑出適合交給工具加速，且仍需要人檢查的工作。', control: { id: 'creative-delegation', type: 'permission-select', label: '選一個要安排的任務', minSelections: 1, maxSelections: 1, options: [{ id: 'adapt', label: '批次調整已核准的版型', value: 'repeatable-work' }, { id: 'culture', label: '判斷在地文化能不能被正確呈現', value: 'cultural-judgment' }, { id: 'final', label: '核准最終品牌內容與權利', value: 'final-approval' }] }, outcomes: [{ choiceId: 'adapt', title: '把重複工作交給流程', text: '已定義的規格可由工具協助產製，讓團隊把時間留給檢查和修正。', insightTag: 'delegation', sourceHighlightIndex: 1 }, { choiceId: 'culture', title: '讓懂情境的人參與', text: '在地文化線索和創意品質需要專業人員設計與確認。', insightTag: 'culture', sourceHighlightIndex: 1 }, { choiceId: 'final', title: '保留清楚的核准責任', text: '品牌規範、安全框架與權利檢查需要明確的人工責任。', insightTag: 'governance', sourceHighlightIndex: 1 }] },
    dialogue: [{ characterId: 'achi', text: '可以同時做更多版本，但每一個都要有負責的人。', kind: 'fictional-dialogue' }, { characterId: 'yingzhen', text: '先把工作拆好，別把判斷也一起交出去。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'practical-application', reason: '協作流程把專業、工具和檢查串在一起，最後要回到消費任務判斷 Agent 能負責到哪一層。', question: '知道顧客的需求後，Agent 可以替他做到哪一步？', visual: '工作室的任務流沿著海岸延伸，化成零售、美妝與保健服務街上的行動路徑。' },
  },
  {
    id: 'A06', chapterId: 'ai', protagonistId: 'fenjie',
    setting: '零售、美妝與保健體驗街各有不同規則，任務越靠近交易或健康判斷，人工確認位置越清楚。',
    lifeEvent: '芬姐聽見顧客說願意讓 Agent 找商品，遇到健康和付款決定時仍想知道誰負責。',
    coreDevice: { id: 'agent-permission-board', label: 'Agent 行動權限板', description: '依任務風險、可逆性和專業要求標出可授權範圍。' },
    interactionType: 'delegation',
    interaction: { prompt: '按任務風險替 Agent 設定行動範圍，並留下人工接手條件。', control: { id: 'task-permission', type: 'permission-select', label: '選擇一項待分工任務', minSelections: 1, maxSelections: 1, options: [{ id: 'retail', label: '零售商品搜尋與結帳', value: 'retail' }, { id: 'beauty', label: '美妝膚況建議與門市協助', value: 'beauty' }, { id: 'health', label: '保健資訊與健康相關判斷', value: 'health' }] }, outcomes: [{ choiceId: 'retail', title: '清楚、可逆的任務可走更遠', text: '零售任務界線較清楚時，Agent 可以協助完成更多流程，仍要有錯誤處理。', insightTag: 'delegation', sourceHighlightIndex: 0 }, { choiceId: 'beauty', title: '診斷和最終選擇分開', text: '美妝 AI 可協助提供膚況資訊，門市人員仍可補上情境與確認。', insightTag: 'human-checkpoint', sourceHighlightIndex: 0 }, { choiceId: 'health', title: '高風險領域要收緊權限', text: '保健內容受法規和健康風險限制，不能讓 Agent 自行越過專業判斷。', insightTag: 'governance', sourceHighlightIndex: 0 }] },
    dialogue: [{ characterId: 'fenjie', text: '可以先幫她找選項，到了健康問題我來接手。', kind: 'fictional-dialogue' }, { characterId: 'achi', text: '那麼最後的決定，還是要清楚知道誰負責。', kind: 'fictional-dialogue' }],
    handoff: { relationType: 'later-reflection', reason: '不同產業的任務授權邊界不同，故事最後回到阿綺，她已能問清問題、查依據和安排接手。', question: '下一次需要答案時，你會先問清楚要解決什麼問題？', visual: '體驗街的路線沿海收束成最初工作室的桌面，阿綺把一支筆放回未完成的價值檢查表。' },
  },
];

const scenarioVisualEffect = (propId, action, reactionText, actorId = null) => ({ propId, action, reactionText, ...(actorId ? { actorId } : {}) });
const SCENARIO_VISUAL_EFFECTS = {
  I01: {
    speed: scenarioVisualEffect('completed-draft', 'stack', '阿綺把完成稿疊在左側，價值表仍空白。'),
    customer: scenarioVisualEffect('user-question', 'center', '阿綺把使用者問題卡推到桌面中央。'),
    risk: scenarioVisualEffect('source-responsibility', 'pair', '映蓁把來源卡與責任卡放在提案旁。', 'yingzhen'),
  },
  I02: {
    survey: scenarioVisualEffect('research-record', 'place', '調查卡放到橋的研究端。'),
    contact: scenarioVisualEffect('delivery-record', 'stack', '送達紀錄疊高，對岸的人仍停下。'),
    conversation: scenarioVisualEffect('bridge-question', 'connect', '阿綺和小岳走到橋兩端，面向彼此。'),
  },
  P01: {
    creator: scenarioVisualEffect('photo-source', 'flip', '映蓁翻開照片背面的來源欄。'),
    reverse: scenarioVisualEffect('version-pair', 'compare', '兩個影像版本並列，差異留在桌面。'),
    label: scenarioVisualEffect('generation-tag', 'reveal', '映蓁揭開生成標記，待核對卡保留。'),
  },
  P02: {
    discover: scenarioVisualEffect('entry-sign', 'turn', '入口資訊牌轉向街口。'),
    trust: scenarioVisualEffect('use-conditions', 'exchange', '芬姐把使用條件交給顧客。'),
    culture: scenarioVisualEffect('culture-table', 'gather', '顧客走到可參與的街角桌。'),
  },
  P03: {
    positioning: scenarioVisualEffect('positioning-card', 'center', '定位卡放在策略工作台中央。'),
    value: scenarioVisualEffect('product-question-pair', 'compare', '商品價值和使用者疑問並列。'),
    culture: scenarioVisualEffect('culture-journey-marker', 'connect', '文化情境卡接到旅程節點。'),
  },
  P04: {
    'three-sources': scenarioVisualEffect('source-triad', 'line-up', '三張獨立來源卡並排。'),
    counterparty: scenarioVisualEffect('counterview-card', 'opposite', '相反立場卡放到證據桌另一側。'),
    hold: scenarioVisualEffect('verification-tray', 'pause', '稿件留在待查盤，發布欄杆不動。'),
  },
  P05: {
    value: scenarioVisualEffect('price-use-tag', 'face', '價格和用途標籤朝向小岳。'),
    emotion: scenarioVisualEffect('life-photo', 'photo', '小岳翻看商品旁的生活照片。'),
    context: scenarioVisualEffect('availability-sign', 'front', '芬姐把取得時間與服務條件放到貨架前。'),
  },
  P06: {
    song: scenarioVisualEffect('stage-chorus', 'sing', '小岳停步面向舞台，附近人群一起抬頭。'),
    cheer: scenarioVisualEffect('cheer-card', 'exchange', '小岳和阿綺交換應援卡。'),
    place: scenarioVisualEffect('shared-stands', 'gather', '人群停在看台前，不再繞場。'),
    story: scenarioVisualEffect('story-photo', 'retell', '小岳拿著照片面向阿綺重述經驗。'),
  },
  P07: {
    detail: scenarioVisualEffect('usage-steps', 'open', '手機使用步驟卡展開。'),
    source: scenarioVisualEffect('experience-source', 'flip', '留言者經驗卡翻面，來源欄朝上。'),
    balance: scenarioVisualEffect('pros-limits', 'pair', '優點卡與限制卡並列在桌上。'),
  },
  P08: {
    glance: scenarioVisualEffect('moving-signal', 'pass', '小岳經過看板，繼續往前走。'),
    watch: scenarioVisualEffect('watch-marker', 'linger', '小岳停在看板前觀看。'),
    join: scenarioVisualEffect('experience-board', 'move', '小岳走到攤位，親手移動文字板。'),
  },
  P09: {
    music: scenarioVisualEffect('radio-common-song', 'listen', '收音機響起，兩代居民停下來。'),
    show: scenarioVisualEffect('theatre-screen', 'open', '劇場布幕拉開，居民面向螢幕。'),
    sport: scenarioVisualEffect('ticket-cheer', 'exchange', '票根放上共看桌，兩人交換應援。'),
    talk: scenarioVisualEffect('shared-photo', 'retell', '兩人面對彼此，照片移向桌面。'),
  },
  M01: {
    'new-category': scenarioVisualEffect('blank-sample-slot', 'empty', '新產品卡旁留著空白樣本槽。'),
    'known-market': scenarioVisualEffect('package-interview-pair', 'compare', '兩個包裝方案和訪談卡並列。'),
    'social-shift': scenarioVisualEffect('stale-scenario-card', 'flip', '舊情境卡翻面，待更新標記露出。'),
  },
  M02: {
    video: scenarioVisualEffect('video-viewer', 'open', '影音裝置展開，觀看刻度亮起。'),
    search: scenarioVisualEffect('search-question', 'present', '搜尋桌出現一張問題卡。'),
    experience: scenarioVisualEffect('experience-table', 'gather', '體驗桌移到地圖節點，人物靠近。'),
  },
  M03: {
    observed: scenarioVisualEffect('observation-record', 'place', '原始觀察紀錄放到天平左側。'),
    estimated: scenarioVisualEffect('assumption-estimate', 'connect', '估計卡連上假設卡，兩者分開可見。'),
    unknown: scenarioVisualEffect('unknown-tray', 'empty', '未解問題留在空盤，沒有補成證據。'),
  },
  M04: {
    compare: scenarioVisualEffect('comparison-limit-sign', 'open', '比較牌翻開，限制欄朝向顧客。'),
    simplify: scenarioVisualEffect('removed-step-board', 'clear', '多餘步驟板移出行進路徑。'),
    assist: scenarioVisualEffect('service-guide', 'assist', '芬姐到顧客旁，指向下一個服務站。'),
  },
  M05: {
    fear: scenarioVisualEffect('employee-concern', 'surface', '顧慮卡從水面下翻出，芬姐停下聆聽。'),
    guidance: scenarioVisualEffect('next-step-sheet', 'center', '空白工作表放在桌面，阿綺提出下一步。', 'achi'),
    silo: scenarioVisualEffect('department-halves', 'split', '水面下兩部門各拿半份資訊，連線停在界線。'),
  },
  A01: {
    'before-pay': scenarioVisualEffect('checkout-info-board', 'face', '顧客在結帳資訊板前核對條件。'),
    'after-order': scenarioVisualEffect('delivery-parcel', 'deliver', '包裹和配送、退貨單移到服務窗口。'),
    support: scenarioVisualEffect('service-ticket', 'assist', '芬姐走到顧客旁接過服務單。'),
  },
  A02: {
    draft: scenarioVisualEffect('task-ledger', 'open', '草稿停在透明任務桌，來源卡可見。'),
    recommend: scenarioVisualEffect('recommendation-pair', 'compare', '兩個建議和限制卡並列等候核對。'),
    execute: scenarioVisualEffect('progress-log', 'reveal', '進度板翻出，缺漏版本標成待確認。'),
  },
  A03: {
    facts: scenarioVisualEffect('answer-source-plate', 'place', '答案花園展開來源牌。'),
    voice: scenarioVisualEffect('brand-story-card', 'foreground', '品牌圖形和故事牌移到答案前景。'),
    experience: scenarioVisualEffect('claim-use-pair', 'compare', '宣稱卡與實際使用卡並列核對。'),
  },
  A04: {
    brief: scenarioVisualEffect('spec-check-stack', 'compare', '素材疊在任務規格旁比較。'),
    brand: scenarioVisualEffect('brand-rework-tray', 'move', '不合語氣的素材移到修改盤。'),
    reviewer: scenarioVisualEffect('approval-source-card', 'place', '來源卡與核准卡放在成品前。'),
  },
  A05: {
    adapt: scenarioVisualEffect('approved-sizes', 'spread', '已核准版型展成多尺寸卡。'),
    culture: scenarioVisualEffect('market-culture-pair', 'pair', '兩地文化卡並列，阿綺停下判斷。', 'achi'),
    final: scenarioVisualEffect('rights-approval-desk', 'handoff', '最終內容和權利卡交到核准桌。'),
  },
  A06: {
    retail: scenarioVisualEffect('shopping-basket', 'deliver', '購物籃和結帳權限卡出現。'),
    beauty: scenarioVisualEffect('beauty-consult-card', 'pair', '膚況資訊和門市諮詢卡並列。'),
    health: scenarioVisualEffect('health-review-card', 'shield', '保健資料旁加上人工確認標記。'),
  },
};

const SCENE_SOURCE_GROUNDING = {
  I01: { highlightIndices: [1, 2], paragraphIndices: [18, 8], rationale: '把文章對效率與價值的區別，改編成企劃人要向客戶說明的問題。' },
  I02: { highlightIndices: [0, 1], paragraphIndices: [7, 21], rationale: '把接觸頻率未必帶來理解深度，轉成兩岸之間的探索裝置。' },
  P01: { highlightIndices: [0, 1], paragraphIndices: [1, 14], rationale: '把真假難辨和品牌需要保留真實差異，轉成尋找影像來源的花園。' },
  P02: { highlightIndices: [0, 2], paragraphIndices: [59, 26], rationale: '以贏得演算法、人心與文化的增長框架安排街區路口。' },
  P03: { highlightIndices: [0, 1], paragraphIndices: [6, 2], rationale: '以表面症狀和真實成長課題的落差，形成策略工作台事件。' },
  P04: { highlightIndices: [0, 1], paragraphIndices: [14], rationale: '以至少三個獨立來源交叉驗證的新聞標準，設計證據橋。' },
  P05: { highlightIndices: [0, 1], paragraphIndices: [2, 5], rationale: '以偏愛、偏心和 Agent 介入購物的差別，形成情境商店選擇。' },
  P06: { highlightIndices: [0, 1], paragraphIndices: [11, 10], rationale: '以娛樂運動創造注意力和共同記憶，安排居民在現場一起參與。' },
  P07: { highlightIndices: [0, 1], paragraphIndices: [10, 7], rationale: '以 AI 可讀取的具體使用經驗和人願意分享的情緒，安排社群對話牆。' },
  P08: { highlightIndices: [0, 1], paragraphIndices: [16, 18], rationale: '把可視曝光和平均觀看秒數的差別，轉成可操作的注意力刻度。' },
  P09: { highlightIndices: [0, 2], paragraphIndices: [62, 1], rationale: '以跨圈層共看、共談和再記起的共同記憶，設計共看廣場。' },
  M01: { highlightIndices: [2], paragraphIndices: [23, 50], rationale: '以 People Model 的模擬結果與適用邊界，安排研究者翻看結果卡背面。' },
  M02: { highlightIndices: [1, 2], paragraphIndices: [4, 7], rationale: '以 Share of Choice Context 和關鍵選擇場域，設計多渠道地圖。' },
  M03: { highlightIndices: [0, 1], paragraphIndices: [21, 2], rationale: '把 AI 生成不等於核實，以及人類負責定方向，轉成證據分類桌。' },
  M04: { highlightIndices: [0, 1], paragraphIndices: [4, 27], rationale: '以旅程中的猶豫節點和下一步支援，形成服務路徑分岔。' },
  M05: { highlightIndices: [0, 1], paragraphIndices: [2, 4, 6], rationale: '以高層和基層的轉型感受落差及水面下阻力，設計文化暗流冰山。' },
  A01: { highlightIndices: [0, 1], paragraphIndices: [2, 10], rationale: '以轉換改善後出現的客服和物流問題，安排服務街上的未完成單據。' },
  A02: { highlightIndices: [0, 2], paragraphIndices: [1, 26], rationale: '以 Agent 不回報工作狀態和 AX 信任設計，安排透明任務面板。' },
  A03: { highlightIndices: [0, 2], paragraphIndices: [10, 22], rationale: '以內容被引用與被記住的差別，設計答案花園中的品牌線索。' },
  A04: { highlightIndices: [1, 2], paragraphIndices: [15, 26], rationale: '以規格、產線、檢驗和品牌品質治理，設計素材檢查工作台。' },
  A05: { highlightIndices: [0, 1], paragraphIndices: [11, 13], rationale: '以 AI 原生製作流程和市場 DNA，在工作室呈現人與工具的分工。' },
  A06: { highlightIndices: [0, 2], paragraphIndices: [2, 3, 4], rationale: '以不同產業的 Agent 自主程度和任務權限，安排零售、美妝與保健服務街。' },
};

const EXTENSION_LINKS = {
  I01: [
    { target: 'M03', relationType: 'research-validation', editorialReason: '成長判斷要分清楚已觀察到的資料和模型推估，才能決定 AI 的速度是否有用。', transitionQuestion: '這份預測是資料、估計，還是還沒有答案？', transitionVisual: '工作室的預測紙滑上證據天平，精確數字背面的假設逐一浮現。' },
    { target: 'P05', relationType: 'different-viewpoint', editorialReason: '企業追求效率與價值時，也需要理解消費者不一定選最划算商品的原因。', transitionQuestion: '效率提高後，人為什麼仍有自己的偏好？', transitionVisual: '價值工作表折成購物清單，清單上的商品走進情境商店。' },
  ],
  I02: [
    { target: 'P04', relationType: 'research-validation', editorialReason: '品牌與人的距離也牽涉信任來源，新聞查證提供如何交叉驗證內容的實例。', transitionQuestion: '接觸變多之後，消費者憑什麼相信品牌？', transitionVisual: '橋上的接觸光點化為查證室裡逐條核對的消息來源。' },
    { target: 'M01', relationType: 'practical-application', editorialReason: '持續理解人需要能反覆驗證的研究方法，People Model 把問題帶進情境對話。', transitionQuestion: '能不能在重大決策前先進行情境對話？', transitionVisual: '橋面的問題卡變成觀察室裡的一張 Persona 情境卡。' },
  ],
  P01: [
    { target: 'P04', relationType: 'research-validation', editorialReason: '找到來源只是第一步，新聞查證提供交叉驗證和暫緩定論的實務。', transitionQuestion: '看起來是真的，就值得相信嗎？', transitionVisual: '影像背面的來源標記變成查證室裡逐項核對的證據卡。' },
    { target: 'P07', relationType: 'different-viewpoint', editorialReason: '真實感也來自使用者自發討論，品牌需要同時看可擷取資訊和真實經驗。', transitionQuestion: '真實的人會怎麼談論這個品牌？', transitionVisual: '花園裡的標籤沿著小徑變成社群巷弄的留言。' },
  ],
  P02: [
    { target: 'P05', relationType: 'practical-application', editorialReason: '增長三角需要在人心建立偏好，購買文章說明品牌如何在推薦之前喚起動機。', transitionQuestion: 'AI 找到划算選項後，品牌怎麼讓人仍然想買？', transitionVisual: '街區裡的贏得人心路標化成商品標籤，帶進情境商店。' },
    { target: 'A01', relationType: 'practical-application', editorialReason: '成長架構要落到體驗服務，觀察顧客在哪個步驟停下來。', transitionQuestion: '顧客走到服務街時，在哪裡開始猶豫？', transitionVisual: '街區的行動路線延伸成結帳頁和服務窗口。' },
  ],
  P03: [
    { target: 'M01', relationType: 'practical-application', editorialReason: '策略要理解真實動機，可以用情境式消費者模擬提出可驗證的假設。', transitionQuestion: '新的策略方向能否先和消費者情境對話？', transitionVisual: '策略工作台的問題卡被帶進消費者觀察室。' },
    { target: 'M03', relationType: 'later-reflection', editorialReason: '定義正確問題之後，仍要檢查資料能否承擔最後的判斷。', transitionQuestion: '策略假設有哪些證據，哪些仍未知？', transitionVisual: '策略藍圖上的資料標記走向證據天平的四個托盤。' },
  ],
  P04: [
    { target: 'P01', relationType: 'problem-cause', editorialReason: '信任競爭的起點是生成內容真假難辨，回頭檢查品牌如何留下真實線索。', transitionQuestion: '在查證之前，影像最初從哪裡出現？', transitionVisual: '查證室的照片原件沿橋退回藝術花園的影像來源牆。' },
    { target: 'A02', relationType: 'practical-application', editorialReason: '可查證的證據也應用在 Agent 服務，讓使用者看見它的工作和依據。', transitionQuestion: 'Agent 能不能像新聞一樣說清楚依據？', transitionVisual: '證據卡變成任務面板上的資料來源和進度記錄。' },
  ],
  P05: [
    { target: 'A06', relationType: 'practical-application', editorialReason: '偏好解釋了人為何想買，Agent 消費旅程則回答選項出現後可以替人做到哪一步。', transitionQuestion: 'AI 替你找到適合的選項後，接下來能替你做到哪一步？', transitionVisual: '商品資訊延伸成搜尋、比較和推薦流程，沿海面抵達 Agent 權限板。' },
    { target: 'P04', relationType: 'research-validation', editorialReason: '品牌偏好需要信任支撐，信任文章提供如何核對品牌說法的依據。', transitionQuestion: '消費者憑什麼相信品牌承諾？', transitionVisual: '商品標籤變成橋上的來源清單，從商店通往查證室。' },
  ],
  P06: [
    { target: 'P09', relationType: 'concept-deepening', editorialReason: '現場參與可以累積情緒，下一步看共同觀看如何變成跨群體的長期記憶。', transitionQuestion: '一場活動過後，人們還會一起記得什麼？', transitionVisual: '散場的應援物排列成懷舊劇場的座位和共看廣場。' },
    { target: 'P08', relationType: 'problem-cause', editorialReason: '娛樂與運動能吸引注意，注意力文章解釋曝光和真正回想的差別。', transitionQuestion: '看見演出，是否代表記住品牌？', transitionVisual: '舞台燈變成街頭媒體場域上的觀看秒數刻度。' },
  ],
  P07: [
    { target: 'A03', relationType: 'practical-application', editorialReason: '社群真實討論能成為 AI 的理解來源，GEO 文章進一步處理被引用與被記住的差別。', transitionQuestion: 'AI 整理了討論，消費者還記得品牌嗎？', transitionVisual: '留言被編成答案花園裡可追溯的知識節點。' },
    { target: 'A04', relationType: 'different-viewpoint', editorialReason: '社群內容要可讀也要有情緒，素材治理需要留下品牌觀點而非大量複製。', transitionQuestion: '內容要怎麼量產又不變得千篇一律？', transitionVisual: '社群留言上的品牌語氣標記進入創意工坊檢查台。' },
  ],
  P08: [
    { target: 'M02', relationType: 'research-validation', editorialReason: '注意力品質要用來挑選關鍵媒體場域，重建 SOV 文章把它放回選擇地圖。', transitionQuestion: '品牌應該在哪些接觸點守住注意力？', transitionVisual: '觀看時間的刻度展成多渠道地圖，渠道不再平均排列。' },
    { target: 'P06', relationType: 'practical-application', editorialReason: '注意力媒體需要真實參與的場域，娛樂和運動提供共同觀看與投入的例子。', transitionQuestion: '哪些娛樂或運動現場能讓人主動投入？', transitionVisual: '街頭媒體的觀看刻度延伸為體育場和演唱會的入場路線。' },
  ],
  P09: [
    { target: 'P06', relationType: 'problem-cause', editorialReason: '共同記憶需要真實參與的文化場景，回到娛樂與運動的現場看它如何發生。', transitionQuestion: '哪些現場活動能讓人一起留下記憶？', transitionVisual: '劇場觀眾的回憶化成體育場和演唱會的共同聲景。' },
    { target: 'M02', relationType: 'practical-application', editorialReason: '共同觀看是品牌爭取選擇情境的一種場域，SOV 文章提供選擇接觸點的觀點。', transitionQuestion: '品牌要在哪些文化場域與不同圈層相遇？', transitionVisual: '共看廣場的觀眾路線映在多渠道選擇地圖上。' },
  ],
  M01: [
    { target: 'M03', relationType: 'research-validation', editorialReason: 'Persona 模擬產生的結果需要區分證據、推估與未知，才適合進入決策。', transitionQuestion: '結果看起來很合理，就代表可以直接拿來決策嗎？', transitionVisual: '模擬結果卡翻面露出限制與未知，沿透明結構抵達證據天平。' },
    { target: 'P05', relationType: 'different-viewpoint', editorialReason: '模擬能呈現偏好線索，實際購買仍包含品牌情緒和個人情境。', transitionQuestion: '模型預測的選擇和消費者想要的是同一件事嗎？', transitionVisual: '觀察室的 Persona 結果卡落在情境商店的選擇架上。' },
  ],
  M02: [
    { target: 'P08', relationType: 'concept-deepening', editorialReason: '渠道選擇要看人是否投入，注意力場域提供曝光以外的觀察方式。', transitionQuestion: '不同渠道的注意力品質如何比較？', transitionVisual: '地圖上的渠道路徑收束為街頭媒體計時器。' },
    { target: 'A03', relationType: 'practical-application', editorialReason: '被選擇的場域也包含 AI 答案中的知識入口，GEO 文章說明內容如何進入答案。', transitionQuestion: '消費者向 AI 提問時，品牌在哪裡被找到？', transitionVisual: '渠道地圖的搜尋路徑展開成答案花園的知識圖譜。' },
  ],
  M03: [
    { target: 'I01', relationType: 'later-reflection', editorialReason: '衡斷力回到全書的起點，提醒 AI 改變做法但沒有替人承擔判斷。', transitionQuestion: '知道什麼仍未知後，企業該怎麼把 AI 用在成長？', transitionVisual: '證據天平收起來，變成阿綺工作桌上的價值檢查表。' },
    { target: 'A02', relationType: 'practical-application', editorialReason: '判斷結果要落到工作流程，Agent 需要顯示它使用的證據和待人工確認處。', transitionQuestion: 'Agent 能否把它的依據和限制一併交代？', transitionVisual: '證據卡變成協作中心上的任務狀態與人工確認標記。' },
  ],
  M04: [
    { target: 'A01', relationType: 'practical-application', editorialReason: '決策地圖需要在真實服務裡檢查顧客停留和流程後果。', transitionQuestion: '旅程設計在服務現場會遇到哪些摩擦？', transitionVisual: '分岔路徑落到服務街上的結帳頁和客服窗口。' },
    { target: 'A06', relationType: 'concept-deepening', editorialReason: '顧客下一步逐漸由 Agent 協助完成，需進一步界定它的行動權限。', transitionQuestion: '生成式體驗要讓 Agent 代替顧客做到哪裡？', transitionVisual: '服務路徑的最後一個岔口伸向行動權限板。' },
  ],
  M05: [
    { target: 'A05', relationType: 'practical-application', editorialReason: '轉型阻力要透過新的工作方法處理，創意代理商展示人與 AI 的分工。', transitionQuestion: '組織文化改變後，工作流程怎麼重新安排？', transitionVisual: '水下的部門界線浮出水面，成為協作工作室的各個工位。' },
    { target: 'A02', relationType: 'different-viewpoint', editorialReason: '文化與角色變化也會影響員工是否信任 Agent 作為新的工作對象。', transitionQuestion: '同事如何知道 Agent 做了什麼、能不能接著用？', transitionVisual: '冰山下的擔心翻成任務牆上的資料狀態和接手按鈕。' },
  ],
  A01: [
    { target: 'M04', relationType: 'research-validation', editorialReason: '服務摩擦不是單一轉換數字能解釋，回到決策地圖檢查問題如何形成。', transitionQuestion: '顧客在哪一步開始猶豫，該怎麼驗證？', transitionVisual: '未完成的服務表單展開成旅程岔路和顧客決策點。' },
    { target: 'A06', relationType: 'practical-application', editorialReason: '體驗優化的下一個階段可能交由 Agent 執行，消費旅程文章說明如何依風險安排權限。', transitionQuestion: '顧客服務中哪些任務適合先交給 Agent？', transitionVisual: '服務街的未完成單據進入 Agent 權限板，標出人工接手位置。' },
  ],
  A02: [
    { target: 'A06', relationType: 'concept-deepening', editorialReason: 'Agent 體驗中的透明和接手，下一步要連到實際消費旅程的授權範圍。', transitionQuestion: '知道 Agent 正在做什麼之後，能把哪些行動交給它？', transitionVisual: '任務狀態線延伸成消費體驗街的權限刻度。' },
    { target: 'M03', relationType: 'research-validation', editorialReason: '信任 Agent 的依據仍需要判斷，將它的輸入、估計和未知分開檢查。', transitionQuestion: 'Agent 的答案屬於資料、估計還是未知？', transitionVisual: '任務面板上的來源標籤變成衡斷力天平的證據分類。' },
  ],
  A03: [
    { target: 'P07', relationType: 'problem-cause', editorialReason: 'AI 答案的引用仰賴真實世界可讀取的討論，回看社群內容從何而來。', transitionQuestion: 'AI 引用的品牌資訊，在社群裡有人這樣談嗎？', transitionVisual: '答案節點展成社群巷弄的留言和使用者經驗。' },
    { target: 'A05', relationType: 'practical-application', editorialReason: 'GEO 要求內容清楚可讀又有品牌特徵，AI 原生製作文章呈現如何串接工具和在地線索。', transitionQuestion: '品牌內容如何在不同通路保持可辨認？', transitionVisual: '答案花園的知識節點變成跨市場創意流程的素材卡。' },
  ],
  A04: [
    { target: 'A02', relationType: 'practical-application', editorialReason: '內容規範還要讓 Agent 能正確讀取服務資訊，AX 文章說明透明內容如何建立信任。', transitionQuestion: '品牌素材要怎麼讓 Agent 和人都理解？', transitionVisual: '檢查台上的規格卡翻面，成為協作中心顯示的來源和服務條件。' },
    { target: 'A03', relationType: 'later-reflection', editorialReason: '素材產出標準不只為了規模，也要回頭檢查內容是否被 AI 正確理解且讓人記得。', transitionQuestion: '素材通過規範後，還留下品牌記憶了嗎？', transitionVisual: '工坊裡的成品卡回到答案花園，查看它在知識圖譜上的位置。' },
  ],
  A05: [
    { target: 'M05', relationType: 'problem-cause', editorialReason: '協作流程能否採用，仍受組織文化和員工對角色改變的感受影響。', transitionQuestion: '新流程會遇到哪些看不見的組織阻力？', transitionVisual: '工作室的任務線垂入水面，映出隱藏的文化暗流。' },
    { target: 'A04', relationType: 'concept-deepening', editorialReason: 'AI 原生製作要維持規模和品質，回到素材規格、產線與檢驗標準。', transitionQuestion: '大規模產製時，品牌品質如何被檢查？', transitionVisual: '跨市場的素材架排列成創意工坊裡的品質檢查台。' },
  ],
  A06: [
    { target: 'P05', relationType: 'later-reflection', editorialReason: 'Agent 完成流程之後，仍要回到人為何偏愛品牌的購買動機。', transitionQuestion: '交易流程結束後，品牌如何仍被人想起？', transitionVisual: '權限板上的零售清單回到情境商店，商品帶著新的故事線索。' },
    { target: 'M04', relationType: 'research-validation', editorialReason: '任務權限的安排需符合顧客的真實決策節點，回到生成式體驗檢查下一步。', transitionQuestion: '這種授權安排是否解決顧客當下的問題？', transitionVisual: '權限刻度折回服務路徑的分岔點，核對任務和情境是否相符。' },
  ],
};

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPositionGenerator(seed) {
  const random = mulberry32(seed);
  const positionsByChapter = new Map();

  return (chapter) => {
    const placed = positionsByChapter.get(chapter.id) ?? [];
    let point;
    for (let attempt = 0; attempt < 10000; attempt += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * CLUSTER_SAMPLE_RADIUS;
      const xStretch = 0.86 + random() * 0.28;
      const zStretch = 0.86 + random() * 0.28;
      const candidate = {
        x: chapter.center.x + Math.cos(angle) * radius * xStretch,
        z: chapter.center.z + Math.sin(angle) * radius * zStretch,
      };
      if (placed.every((existing) => Math.hypot(candidate.x - existing.x, candidate.z - existing.z) >= MIN_ISLAND_SPACING)) {
        point = candidate;
        break;
      }
    }
    if (!point) throw new RangeError(`Could not place an island in the ${chapter.id} cluster.`);

    const rounded = { x: Number(point.x.toFixed(3)), z: Number(point.z.toFixed(3)) };
    if (placed.some((existing) => Math.hypot(rounded.x - existing.x, rounded.z - existing.z) < MIN_ISLAND_SPACING)) {
      throw new RangeError(`Island spacing in the ${chapter.id} cluster fell below ${MIN_ISLAND_SPACING}.`);
    }
    positionsByChapter.set(chapter.id, [...placed, rounded]);
    return rounded;
  };
}

function requireEdition(edition) {
  if (!edition || !Array.isArray(edition.articles) || edition.articles.length !== ARTICLE_ORDER.length) {
    throw new TypeError(`Expected an edition containing ${ARTICLE_ORDER.length} articles.`);
  }
  const articles = [...edition.articles].sort((a, b) => a.order - b.order);
  articles.forEach((article, index) => {
    if (!article?.id || !article.title || !article.summary || !Array.isArray(article.paragraphs)) {
      throw new TypeError(`Article at order ${index + 1} is missing required source fields.`);
    }
    const expectedId = `2026-${String(index + 1).padStart(2, '0')}`;
    if (article.order !== index + 1 || article.id !== expectedId) {
      throw new TypeError(`Article at order ${index + 1} must be the source article ${expectedId}.`);
    }
  });
  return articles;
}

function buildArticle(article, islandId, chapterId) {
  const highlights = Array.isArray(article.highlights) ? article.highlights : [];
  const quickRead = article.summary;
  const threeMinuteParagraphs = [article.summary, ...highlights].filter(Boolean);
  return {
    ...article,
    islandId,
    chapterId,
    fullArticle: {
      articleId: article.id,
      url: `/read/2026/${article.id}.html`,
      pdf: article.sourcePdf,
      pages: article.sourcePages,
    },
    reading: {
      thirtySecond: { seconds: 30, text: quickRead, source: 'summary' },
      threeMinute: { minutes: 3, paragraphs: threeMinuteParagraphs, source: 'summary-and-highlights' },
    },
  };
}

function buildSourceGrounding(article, islandId) {
  const references = SCENE_SOURCE_GROUNDING[islandId];
  if (!references) throw new TypeError(`No source grounding exists for island ${islandId}.`);
  const highlights = references.highlightIndices.map((index) => {
    const text = article.highlights?.[index];
    if (!text) throw new TypeError(`Article ${article.id} has no highlight at index ${index}.`);
    return { kind: 'editorial-highlight', sourceArticleId: article.id, sourceField: 'highlights', index, text };
  });
  const paragraphs = references.paragraphIndices.map((index) => {
    const text = article.paragraphs?.[index];
    if (!text) throw new TypeError(`Article ${article.id} has no paragraph at index ${index}.`);
    return {
      kind: 'source-paragraph',
      sourceArticleId: article.id,
      attribution: article.authors ?? null,
      index,
      sourcePage: article.paragraphSources?.[index]?.sourcePage ?? null,
      text,
    };
  });
  return { sourceArticleId: article.id, rationale: references.rationale, highlights, paragraphs };
}

function buildGraphEdge(source, target, relationType, editorialReason, transitionQuestion, transitionVisual, priority) {
  return { sourceArticleId: source, targetArticleId: target, relationType, editorialReason, transitionQuestion, transitionVisual, priority };
}

export function buildData(edition) {
  const sourceArticles = requireEdition(edition);
  const articleBySourceId = new Map();
  const islandByCanonicalId = new Map(SCENE_CATALOG.map((scene) => [scene.id, scene]));
  const chapterById = new Map(CHAPTERS.map((chapter) => [chapter.id, chapter]));
  const randomPosition = buildPositionGenerator(WORLD_SEED);

  const islands = sourceArticles.map((article, index) => {
    const canonicalId = ARTICLE_ORDER[index];
    const scene = islandByCanonicalId.get(canonicalId);
    const chapter = chapterById.get(scene.chapterId);
    if (article.chapter !== scene.chapterId) {
      throw new TypeError(`Article ${article.id} belongs to ${article.chapter}; ${canonicalId} requires ${scene.chapterId}.`);
    }
    articleBySourceId.set(article.id, article);
    const position = randomPosition(chapter);
    return {
      id: canonicalId,
      articleId: article.id,
      chapterId: scene.chapterId,
      position,
      sceneId: `${canonicalId}-scene`,
      interactionId: scene.interactionType,
    };
  });

  const articles = sourceArticles.map((article, index) => buildArticle(article, ARTICLE_ORDER[index], article.chapter));
  const sceneByCanonical = new Map(SCENE_CATALOG.map((scene) => [scene.id, scene]));
  const scenes = islands.map((island) => {
    const design = sceneByCanonical.get(island.id);
    const article = articleBySourceId.get(island.articleId);
    const interactionDefinition = INTERACTIONS.find(({ id }) => id === design.interactionType);
    const visualEffects = SCENARIO_VISUAL_EFFECTS[island.id];
    const choiceIds = design.interaction.control.options.map(({ id }) => id);
    if (Object.keys(visualEffects || {}).length !== choiceIds.length || choiceIds.some((id) => !visualEffects[id])) {
      throw new TypeError(`Scenario visual effects must match every ${island.id} choice.`);
    }
    const interaction = {
      ...design.interaction,
      sourceArticleId: article.id,
      sourceEvidence: article.highlights?.[0] ?? article.summary,
      outcomes: design.interaction.outcomes.map((outcome) => ({
        ...outcome,
        visualEffect: {
          id: `${island.id}-${outcome.choiceId}`,
          actorId: visualEffects[outcome.choiceId].actorId || design.protagonistId,
          ...visualEffects[outcome.choiceId],
        },
        sourceArticleId: article.id,
        sourceEvidence: article.highlights?.[outcome.sourceHighlightIndex] ?? article.summary,
      })),
    };
    return {
      id: island.sceneId,
      islandId: island.id,
      articleId: article.id,
      interactionId: interactionDefinition.id,
      interactionType: interactionDefinition.kind,
      insightStampId: Object.entries(INSIGHT_STAMPS).find(([, ids]) => ids.includes(island.id))[0],
      setting: design.setting,
      lifeEvent: design.lifeEvent,
      protagonistId: design.protagonistId,
      characterIds: [...new Set([design.protagonistId, ...design.dialogue.map(({ characterId }) => characterId)])],
      coreDevice: design.coreDevice,
      dialogue: design.dialogue.map((line) => ({ ...line, fictional: true })),
      interaction,
      sourceGrounding: buildSourceGrounding(article, island.id),
      transition: { ...design.handoff },
    };
  });

  const canonicalByArticleId = new Map(islands.map(({ id, articleId }) => [id, articleId]));
  const articleIdForCanonical = (canonicalId) => {
    const articleId = canonicalByArticleId.get(canonicalId);
    if (!articleId) throw new TypeError(`No article mapping exists for island ${canonicalId}.`);
    return articleId;
  };

  const articleGraph = [];
  for (let index = 0; index < islands.length - 1; index += 1) {
    const current = islands[index];
    const next = islands[index + 1];
    const design = sceneByCanonical.get(current.id);
    const currentArticle = articleBySourceId.get(current.articleId);
    const nextArticle = articleBySourceId.get(next.articleId);
    articleGraph.push(buildGraphEdge(
      current.articleId,
      next.articleId,
      design.handoff.relationType,
      `${design.handoff.reason} ${currentArticle.title} 引出的問題由「${nextArticle.title}」接續。`,
      design.handoff.question,
      design.handoff.visual,
      1,
    ));
  }

  const lastIsland = islands.at(-1);
  const firstIsland = islands[0];
  const lastDesign = sceneByCanonical.get(lastIsland.id);
  articleGraph.push(buildGraphEdge(
    lastIsland.articleId,
    firstIsland.articleId,
    lastDesign.handoff.relationType,
    `${lastDesign.handoff.reason} 全書回到「${articleBySourceId.get(firstIsland.articleId).title}」，讓讀者重新檢視開場問題。`,
    lastDesign.handoff.question,
    lastDesign.handoff.visual,
    1,
  ));

  for (const [sourceCanonicalId, links] of Object.entries(EXTENSION_LINKS)) {
    for (const [index, link] of links.entries()) {
      articleGraph.push(buildGraphEdge(
        articleIdForCanonical(sourceCanonicalId),
        articleIdForCanonical(link.target),
        link.relationType,
        link.editorialReason,
        link.transitionQuestion,
        link.transitionVisual,
        index + 2,
      ));
    }
  }

  const mainStoryArticles = islands.map(({ articleId }) => articleId);
  const chapterEntries = CHAPTERS.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    englishTitle: chapter.englishTitle,
    themeId: chapter.themeId,
    center: { ...chapter.center },
    articleIds: islands.filter((island) => island.chapterId === chapter.id).map(({ articleId }) => articleId),
  }));

  return {
    meta: {
      id: edition.id ?? `decision-intelligence-${edition.year ?? 2026}`,
      title: edition.title ?? '電通《2026 決策智慧》',
      year: edition.year ?? 2026,
      seed: WORLD_SEED,
      layout: { minimumIslandSpacing: MIN_ISLAND_SPACING, clusterRadiusLimit: CLUSTER_RADIUS_LIMIT },
      sourceSchemaVersion: edition.schemaVersion ?? null,
      articleCount: articles.length,
      islandCount: islands.length,
      contentDisclosure: '文章摘要與重點取自原刊資料；人物、場景和對白皆為原創虛構情境，不代表作者引言。',
    },
    chapters: chapterEntries,
    articles,
    islands,
    characters: CHARACTERS.map((character) => ({ ...character })),
    scenes,
    interactions: INTERACTIONS.map((interaction) => ({ ...interaction, outputFields: [...interaction.outputFields] })),
    articleGraph,
    storyRoutes: [{
      id: 'main-story',
      title: '從答案到判斷，再到行動',
      mode: 'story',
      articleIds: mainStoryArticles,
      chapterIds: CHAPTERS.map(({ id }) => id),
      transitions: articleGraph.filter((edge) => edge.priority === 1),
      ending: {
        articleId: mainStoryArticles.at(-1),
        characterId: 'achi',
        text: '阿綺把最初那份簡報收起來，留下已核對的依據和仍待回答的問題。這次，她知道該讓 AI 做什麼，也知道哪些判斷要由人承擔。',
        returnToArticleId: mainStoryArticles[0],
        returnToChapterId: 'intro',
      },
    }],
    visualThemes: VISUAL_THEMES.map((theme) => ({ ...theme, palette: [...theme.palette], motifs: [...theme.motifs], editorialMotifs: cloneEditorialMotifs(theme.editorialMotifs) })),
    progressConfig: {
      storageKey: 'dentsu-decision-intelligence-2026-progress',
      modes: ['story', 'explore'],
      completionUnit: 'article',
      readStateValues: ['unread', 'in-progress', 'completed'],
      insightStamps: [
        { id: 'truth', label: '真實' }, { id: 'trust', label: '信任' }, { id: 'preference', label: '偏好' },
        { id: 'memory', label: '共同記憶' }, { id: 'attention', label: '注意力' }, { id: 'people', label: '消費者洞察' },
        { id: 'judgment', label: '衡斷力' }, { id: 'experience', label: '體驗' }, { id: 'governance', label: '內容治理' },
        { id: 'delegation', label: 'Agent 協作' },
      ],
      stampsAreReadingFootprints: true,
      interactionsAreOptional: true,
    },
    i18n: {
      locale: 'zh-TW',
      labels: {
        storyMode: '故事探索', exploreMode: '自由探索', quickRead: '30 秒核心導讀', guidedRead: '3 分鐘重點整理',
        fullArticle: '深度閱讀原文', relatedIslands: '延伸航線', returnToMap: '返回群島地圖',
        fictionalScene: '虛構情境', sourceArticle: '原刊文章', optionalInteraction: '可略過的互動',
      },
    },
  };
}

export { ARTICLE_ORDER, INTERACTIONS, WORLD_SEED };
