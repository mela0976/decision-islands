import type { MissionChangeHint } from './mission-stage-types';

const e = (
  entityIds: readonly string[],
  beforeZh: string,
  beforeEn: string,
  afterZh: string,
  afterEn: string,
): MissionChangeHint => ({
  entityIds,
  before: { zh: beforeZh, en: beforeEn },
  after: { zh: afterZh, en: afterEn },
});

export const MARKETING_MISSION_HINTS: Readonly<
  Record<string, Readonly<Record<'a' | 'b', readonly MissionChangeHint[]>>>
> = {
  'seen-remembered-1': {
    a: [e(['analyst', 'document'], '杯子提案尚未列清規格', 'The mug brief lacks clear specs.', '補上規格後，文件列出容量清潔', 'Facts add capacity and care details.')],
    b: [e(['analyst', 'mug', 'bag', 'chart'], '杯子提案尚未呈現通勤時刻', 'The brief lacks a commuting moment.', '補上行程後，包與杯標出使用時刻', 'Chart links mug to daily use.')],
  },
  'seen-remembered-2': {
    a: [e(['analyst', 'document', 'microphone'], '留言與指南分在手機與文件', 'Comments and a guide sit apart.', '整理常見問題，文件成為查找指南', 'The guide groups common questions.')],
    b: [e(['analyst', 'user', 'microphone', 'document'], '指南旁只有使用者留言', 'Comments sit by product guide.', '分析員記下使用者的通勤故事', 'Analyst records user commute.')],
  },
  'seen-remembered-3': {
    a: [e(['analyst', 'manager', 'document', 'phone', 'poster'], '三類接觸點尚未分組', 'Three touchpoint cards sit apart.', '補強系統資訊，卡片移向螢幕', 'System details move onto the screen.')],
    b: [e(['analyst', 'manager', 'phone', 'poster', 'heart'], '三類接觸點尚未分組', 'Three touchpoint cards sit apart.', '連起社群與體驗，討論接上海報', 'Poster links talk to experiences.')],
  },
  'scale-distinctiveness-1': {
    a: [e(['marketer', 'document', 'poster', 'shield'], '空白規格旁放著競品範例', 'Competitors flank blank brand guide.', '行銷寫下規格，文件列出品牌特徵', 'Marketer lists brand voice, claims.')],
    b: [e(['marketer', 'robot', 'screen', 'document', 'poster'], '品牌特色尚未定進規格', 'Brand qualities are not set yet.', '先看創意方向，再圈出品牌特色', 'The marketer selects brand traits.')],
  },
  'scale-distinctiveness-2': {
    a: [e(['editor', 'document', 'creative'], '主視覺已共用，文案尚未在地', 'The shared visual lacks local copy.', '沿用畫面，編輯改寫當地文案', 'Editor adapts local captions.')],
    b: [e(['editor', 'creative', 'globe', 'document', 'screen', 'poster'], '在地線索待用於畫面', 'Local cues await use in the scenes.', '先整理在地線索，再帶動畫面改版', 'Local cues guide the revised scenes.')],
  },
  'scale-distinctiveness-3': {
    a: [e(['director', 'contributor', 'document'], '腳本與產品仍在鏡頭旁', 'Script and product await filming.', '保留自然停頓，導演留住真人瞬間', 'The director keeps a natural pause.')],
    b: [e(['director', 'contributor', 'mug', 'clapperboard'], '腳本與產品仍在鏡頭旁', 'Script and product await filming.', '拍下真人使用，杯子進入生活場景', 'Contributor uses mug on camera.')],
  },
  'research-decision-1': {
    a: [e(['robot', 'lead', 'chart', 'document'], '方案還未標明模擬假設', 'Support options lack evidence tags.', '標成模擬後，主管挑出待查問題', 'Labels guide what the lead tests.')],
    b: [e(['lead', 'user', 'microphone', 'document'], '流程圖旁尚無使用者經驗', 'The journey map lacks user input.', '訪談使用者，團隊記下實際經驗', 'Team records a user’s experience.')],
  },
  'research-decision-2': {
    a: [e(['lead', 'peer', 'document'], '摘要建議已出，決策理由未寫', 'Recommendation basis not recorded.', '主管寫下理由，團隊可回看決定', 'Lead records the decision basis.')],
    b: [e(['lead', 'peer', 'document', 'chart'], '不同角色的風險仍分列兩側', 'Role-specific risks sit apart.', '彙整角色風險，主管比較流程影響', 'Lead compares risks across roles.')],
  },
  'research-decision-3': {
    a: [e(['robot', 'lead', 'case-a', 'chart'], '流程試行尚未追蹤轉交案件', 'Pilot has not tracked handoffs.', '先試一案，主管記下轉交步驟', 'The lead logs one case handoff.')],
    b: [e(['robot', 'lead', 'case-a', 'case-b', 'document', 'shield'], '案件待試行，轉交與回復條件在旁', 'Cases wait; rollback notes ready.', '擴大到兩案，主管檢查回復條件', 'Two cases trialed; rollback checked.')],
  },
  'agent-investment-1': {
    a: [e(['robot', 'staff', 'phone', 'document', 'shield'], '案件範圍與停止規則各在一旁', 'Case notes beside scope rules.', '客服先審草稿，再用手機送出', 'Staff review draft, then send.')],
    b: [e(['robot', 'staff', 'phone', 'document', 'shield'], '案件範圍與停止規則各在一旁', 'Case notes beside scope rules.', '核准回覆自動送出，例外交客服', 'Approved FAQs send; route exceptions')],
  },
  'agent-investment-2': {
    a: [e(['staff', 'lead', 'document'], '任務清單尚未標出例外', 'Task list lacks exception notes.', '前線標出可交任務，主管核對', 'Staff mark tasks for lead review.')],
    b: [e(['staff', 'lead', 'robot', 'document', 'screen'], '任務清單尚未有試跑紀錄', 'No agent pilot is recorded yet.', '自願小組試跑，主管記錄分工', 'The lead records pilot roles.')],
  },
  'agent-investment-3': {
    a: [e(['robot', 'staff', 'phone', 'document'], '停止與紀錄規則已擺上桌', 'Stop and log rules are ready.', '逐則交客服確認，再由手機送出', 'Staff approve replies, then send.')],
    b: [e(['robot', 'staff', 'phone', 'document', 'shield', 'check'], '客服尚未分流常見與複雜案件', 'Common and complex cases mixed.', '常見回覆自動送出，例外留有紀錄', 'FAQs send; staff get exception logs.')],
  },
  'creative-value-1': {
    a: [e(['creative', 'user', 'microphone'], '腳本與產品已備，尚未訪談使用者', 'Script ready; no user story yet.', '訪談後，麥克風帶出生活細節', 'Mic captures daily user details.')],
    b: [e(['creative', 'user', 'document', 'mug'], '腳本與產品已備，尚未訪談使用者', 'Script ready; no user story yet.', '交出腳本，兩人按安排拍生活情境', 'User stages a scripted daily scene.')],
  },
  'creative-value-2': {
    a: [e(['editor', 'document', 'creative'], '在地簡報尚未寫入文化線索', 'The local brief lacks cultural cues.', '在地編輯先寫場景語言人物線索', 'Editor adds local people and words.')],
    b: [e(['creative', 'editor', 'document', 'screen', 'clapperboard'], '共用素材尚未交給在地編輯', 'Shared assets await a local editor.', '交出共用素材，編輯調整版本', 'Editor adapts shared assets.')],
  },
  'creative-value-3': {
    a: [e(['creative', 'editor', 'document', 'check'], '各市場版本尚未有共同檢查項', 'Market versions lack shared checks.', '列出檢查項，清單標記品牌文化', 'Checklist covers brand and culture.')],
    b: [e(['creative', 'editor', 'poster', 'document', 'check'], '兩人先對照各市場版本', 'Both compare market versions.', '共同審片，兩人對照用語和文化', 'Editors compare on-screen language.')],
  },
  'content-resonance-1': {
    a: [e(['editor', 'user', 'document', 'microphone', 'heart'], '產品資料與留言並列，尚未成指南', 'Product facts and comments apart.', '整理常見問題，文件成為使用指南', 'The editor makes FAQs into a guide.')],
    b: [e(['editor', 'user', 'microphone', 'document', 'heart'], '貼文有產品資料，尚缺使用故事', 'Post has details, no lived story.', '聽使用者分享，編輯記下真實用語', 'Editor records user’s own words.')],
  },
  'content-resonance-2': {
    a: [e(['editor', 'robot', 'document', 'screen', 'mug', 'calendar'], '產品規格尚未置於文章開頭', 'Product facts are not up front yet.', '先放常見規格，文件接上產品資訊', 'Article leads with product facts.')],
    b: [e(['editor', 'document', 'mug', 'calendar', 'screen'], '規格與生活場景尚未連結', 'Need and product facts sit apart.', '排出日常時刻，資訊接上情境', 'Daily scenes link to product facts.')],
  },
  'content-resonance-3': {
    a: [e(['creator', 'user', 'microphone', 'document'], '新稿流暢，尚無使用者原話', 'Polished draft has no user voice.', '訪談後，使用者用語進入新稿', 'The user’s words enter the draft.')],
    b: [e(['creator', 'user', 'document', 'microphone', 'heart'], '新稿缺少創作者親歷脈絡', 'The draft lacks personal context.', '保留第一人稱，創作者寫下觀察', 'Creator adds a personal observation.')],
  },
  'media-measurement-1': {
    a: [e(['analyst', 'chart', 'camera', 'screen', 'phone'], '月報有曝光，尚未列觀看時間', 'Exposure shown; watch time missing.', '補觀看秒數，圖表依版位比較', 'Chart compares watch time by format.')],
    b: [e(['analyst', 'chart', 'camera', 'phone'], '自願互動尚未獨立記錄', 'Voluntary engagement not split out.', '記錄自願互動，分開看曝光', 'Chart adds voluntary interaction.')],
  },
  'media-measurement-2': {
    a: [e(['analyst', 'manager', 'chart', 'poster', 'phone', 'heart'], '線上與門市報表各自呈現', 'Online and store reports sit apart.', '按可見度與互動分組報表', 'Analyst groups views, interactions.')],
    b: [e(['analyst', 'manager', 'chart', 'poster', 'phone', 'heart'], '線上與門市報表各自呈現', 'Online and store reports sit apart.', '排出選擇路徑，串起社群與體驗', 'Map links phone, community, events.')],
  },
  'media-measurement-3': {
    a: [e(['analyst', 'participant', 'document', 'magnifier'], '引用報告與回想問卷尚未拆看', 'Pair citations with recall reports.', '查核引用來源，文件標出出現情境', 'Analyst checks citation locations.')],
    b: [e(['analyst', 'participant', 'microphone', 'document', 'chart'], '報告並列，尚無回想回答', 'Reports paired; recall unasked.', '詢問品牌記憶，麥克風記下接觸時刻', 'Mic records brand recall.')],
  },
  'insight-evidence-1': {
    a: [e(['robot', 'analyst', 'document', 'book', 'magnifier'], 'AI報告未標明證據層級', 'The report lacks evidence labels.', '標成模擬，分析員列待查假設', 'Analyst marks simulations to test.')],
    b: [e(['analyst', 'book', 'document'], 'AI報告的來源尚未核對', 'The report’s source is unchecked.', '回查研究紀錄，文件對照報告說法', 'Analyst compares claims to records.')],
  },
  'insight-evidence-2': {
    a: [e(['analyst', 'phone', 'document', 'chart'], '貼文聲量尚未讀出語意', 'Post volume clear; meaning unknown.', '抽樣讀留言，分辨稱讚抱怨推薦', 'Posts: praise, complaints, referrals')],
    b: [e(['analyst', 'phone', 'document', 'chart'], '貼文尚未標記推薦語句', 'Recommendation language is untagged.', '先標推薦用語，再統計數量', 'Analyst tags referrals, then counts.')],
  },
  'insight-evidence-3': {
    a: [e(['analyst', 'staff', 'shopper', 'document', 'microphone'], '搜尋圖表外的到店原因未明', 'Search data misses visit reasons.', '訪談店員顧客，記下路過與推薦', 'Interviews log walk-ins, referrals.')],
    b: [e(['analyst', 'shopper', 'chart', 'document'], '儀表板目前只有搜尋資料', 'Dashboard shows search alone.', '加入門市口碑，並列不同來源', 'Store and word-of-mouth join search.')],
  },
};
