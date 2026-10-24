import type { I18nText } from './explorer-types';

export interface NpcArticleScenario {
  articleId: string;
  expectedTitle: string;
  family: NpcScenarioFamily;
  anchor: I18nText;
  issue: I18nText;
  point: I18nText;
  action: I18nText;
  tradeoff: I18nText;
}

export type NpcScenarioFamily = 'trust' | 'attention' | 'understanding' | 'delegation';
export const NPC_DIALOGUE_ROLE_IDS = ['curator', 'researcher', 'reader', 'student', 'parent', 'cyclist', 'gardener', 'worker', 'traveler'] as const;
export type NpcDialogueRoleId = (typeof NPC_DIALOGUE_ROLE_IDS)[number];

export interface NpcRoleScenario {
  situation: I18nText;
  action: I18nText;
  cost: I18nText;
}

type NpcRoleScenarios = Readonly<Record<NpcScenarioFamily, NpcRoleScenario>>;

export const NPC_ROLE_SCENARIOS: Readonly<Record<NpcDialogueRoleId, NpcRoleScenarios>> = {
  curator: {
    trust: {
      situation: { zh: '我在替展覽導讀挑一句關於 AI 的說法，卻找不到可以回查的來源。', en: 'I am choosing a claim about AI for an exhibition guide but cannot find a source to check.' },
      action: { zh: '把來源和不確定之處寫進導讀，查不到的說法先不當成結論', en: 'include the source and uncertainty in the guide, and leave unverifiable claims out of the conclusion' },
      cost: { zh: '導讀要多一次查核，也可能得刪掉一段吸引人的文字', en: 'the guide needs another review, and an engaging line may have to go' },
    },
    attention: {
      situation: { zh: '我在設計展覽時，怕觀眾看完一段品牌影片就走，沒有留下共同記憶。', en: 'I am designing an exhibition and worry visitors will watch a brand video and leave with no shared memory.' },
      action: { zh: '安排一個能讓不同觀眾分享自身記憶的互動問題，而不是再加一段宣傳片', en: 'add an interaction where different visitors share a memory instead of another promotional video' },
      cost: { zh: '互動比播放素材難控制，也要多花時間試走', en: 'an interaction is harder to control than a video and takes more time to test' },
    },
    understanding: {
      situation: { zh: '我在展場看到第一次來的觀眾停在同一個展標前，還不確定是字太難還是脈絡不清楚。', en: 'First-time visitors pause at one label, and I do not know whether the wording or context is unclear.' },
      action: { zh: '請一位第一次參觀的人說說他看懂什麼，再依卡住的地方改導讀', en: 'ask a first-time visitor what they understood, then revise the guide around where they got stuck' },
      cost: { zh: '要多排一輪試讀，不能只憑策展團隊的熟悉感定稿', en: 'we need another read-through instead of relying on the curatorial team’s familiarity' },
    },
    delegation: {
      situation: { zh: '我想用 AI 整理展覽資料，但展場最後放什麼解讀仍要由策展人負責。', en: 'I want AI to organize exhibition material, while curators remain responsible for the interpretation visitors see.' },
      action: { zh: '讓 AI 協助整理有來源的資料，由策展人選擇觀點並核准展出內容', en: 'let AI organize sourced material while a curator chooses the interpretation and approves what goes on display' },
      cost: { zh: '少不了人工覆核，展覽準備不會因為一鍵生成就結束', en: 'human review remains necessary, so a one-click draft does not finish the exhibition work' },
    },
  },
  researcher: {
    trust: {
      situation: { zh: '我準備把一段 AI 摘要寫進報告，卻還沒找到原始資料和相反證據。', en: 'I am about to put an AI summary in a report but have not found primary material or contrary evidence.' },
      action: { zh: '逐項標明主張的來源，找原始資料和另一方說法交叉核對', en: 'trace each claim to its source and compare primary material with another perspective' },
      cost: { zh: '報告會晚一點完成，也可能拿掉無法證實的結論', en: 'the report takes longer and may lose a conclusion that cannot be substantiated' },
    },
    attention: {
      situation: { zh: '我在向團隊報告研究結果時，不想讓一張很漂亮的圖表蓋過受訪者真正說的話。', en: 'When presenting research, I do not want a polished chart to hide what participants actually said.' },
      action: { zh: '用一段可追溯的受訪者觀察說清楚議題，再交代它和整體資料的關係', en: 'show one traceable participant observation and explain how it relates to the broader data' },
      cost: { zh: '故事沒有單一漂亮數字俐落，也要交代它的適用範圍', en: 'a story is less tidy than one metric and needs its scope explained' },
    },
    understanding: {
      situation: { zh: '我手上的樣本沒有涵蓋新的族群，卻被要求馬上回答他們會怎麼選。', en: 'My sample does not cover a new group, yet I am asked to predict their choices immediately.' },
      action: { zh: '把資料支持、模型估計和待驗假設分開，再找合適對象補問', en: 'separate data-supported findings, model estimates, and hypotheses, then ask suitable participants' },
      cost: { zh: '結論會比較窄，補資料也會拖慢決策', en: 'the conclusion is narrower and gathering more evidence slows the decision' },
    },
    delegation: {
      situation: { zh: '研究代理能很快整理訪談，卻不能替我決定抽樣是否足以支持研究結論。', en: 'A research agent can summarize interviews quickly but cannot decide whether the sample supports the conclusion.' },
      action: { zh: '讓代理先整理來源與重複主題，由研究者核對樣本、反例和結論', en: 'let the agent organize sources and recurring themes while a researcher checks the sample, counterexamples, and conclusion' },
      cost: { zh: '研究者仍要花時間查原文，不能把分析責任轉給工具', en: 'researchers still need time with the source material and cannot hand off analytical responsibility' },
    },
  },
  reader: {
    trust: {
      situation: { zh: '讀書會有人轉傳一段很肯定的 AI 健康說法，我想分享又怕來源不可靠。', en: 'Someone shares a confident AI health claim in the reading group, and I am unsure whether it is reliable.' },
      action: { zh: '先找原始來源或詢問合適的專業人員，查不到就不把轉傳內容當事實', en: 'look for the primary source or ask an appropriate professional, and do not repeat an unverified claim as fact' },
      cost: { zh: '話題可能慢一點才聊得下去，但不會讓未查證的話越傳越廣', en: 'the conversation may slow down, but an unchecked claim does not spread further' },
    },
    attention: {
      situation: { zh: '我和社區讀書會安排聚會時，想讓大家一起記得一件事，不只是選最多人按讚的活動。', en: 'I am planning a reading-group gathering and want a shared memory, not just the activity with the most likes.' },
      action: { zh: '問大家想共同做什麼，再留一個能讓不同年齡成員參與的環節', en: 'ask what people want to do together and leave room for members of different ages to join' },
      cost: { zh: '需要多聽幾種偏好，活動也不一定能照一個人的理想安排', en: 'hearing several preferences takes time, and no one person gets everything their way' },
    },
    understanding: {
      situation: { zh: '我在讀書會聽到兩種相反的生活經驗，不能只拿一篇文章替大家下結論。', en: 'Two people share different life experiences, so one article cannot settle the question for everyone.' },
      action: { zh: '把文章當成一個提問，再請大家用自己的經驗補充或反駁', en: 'use the article as a question and invite people to add or challenge it with their own experience' },
      cost: { zh: '討論不會很快收斂，但能看見不同經驗之間的差別', en: 'the discussion takes longer to converge but reveals differences in experience' },
    },
    delegation: {
      situation: { zh: '我想讓 AI 摘要社區活動公告，但日期和地點錯一次就會害大家白跑。', en: 'I want AI to summarize a community notice, but a wrong date or location would waste people’s trip.' },
      action: { zh: '用摘要先抓活動重點，再對照主辦單位公告確認日期和地點', en: 'use the summary for orientation, then confirm the date and location with the organizer' },
      cost: { zh: '仍要回去看一次公告，不能把轉述當成正式通知', en: 'I still need to check the notice instead of treating a summary as official' },
    },
  },
  student: {
    trust: {
      situation: { zh: '我的課堂簡報引用了 AI 生成的句子，現在還找不到能支持它的原始資料。', en: 'My class slides include an AI-generated claim, and I cannot find the source that supports it.' },
      action: { zh: '回到原始資料找得到的證據，找不到就改成清楚標示的問題', en: 'return to the source for evidence, and turn an unsupported claim into an explicit question' },
      cost: { zh: '要花時間重做投影片，也不能把看起來合理當成正確', en: 'I may need to redo slides, and plausible wording is not enough' },
    },
    attention: {
      situation: { zh: '我報告時怕同學只記得動畫和標題，沒有記住我真正想說的事。', en: 'I worry classmates will remember the animations and title but miss my main point.' },
      action: { zh: '用一個同學熟悉的真實例子帶出主張，刪掉和重點無關的裝飾', en: 'use a real example classmates recognize and remove decoration that does not support the point' },
      cost: { zh: '簡報不會塞進所有資料，得挑最能說明主張的內容', en: 'the presentation cannot include every detail, so I must choose what best explains the claim' },
    },
    understanding: {
      situation: { zh: '作業答案看起來很順，我卻不確定自己能不能不用 AI 說明推理過程。', en: 'My assignment reads smoothly, but I am unsure I can explain the reasoning without AI.' },
      action: { zh: '先合上生成稿，用課堂資料自己講一次，再標出仍不懂的步驟', en: 'put the generated draft aside, explain the steps from class material, and mark what I still do not understand' },
      cost: { zh: '會多花一段練習時間，但能分出完成文字和真的學會', en: 'it takes another practice session but separates finished writing from learning' },
    },
    delegation: {
      situation: { zh: '我想用 AI 整理參考資料，但報告的主張和引用責任還是我的。', en: 'I want AI to organize references, but I remain responsible for the paper’s argument and citations.' },
      action: { zh: '只請 AI 分類我提供的來源，逐筆打開原文核對，再自己寫出論點', en: 'ask AI to sort sources I provide, open each source to verify it, and write the argument myself' },
      cost: { zh: '引用資料仍需逐筆檢查，不能把整理完成當成內容正確', en: 'every citation still needs a check, since an organized list is not proof' },
    },
  },
  parent: {
    trust: {
      situation: { zh: '家長群組轉來一個教育或消費方案，說得很肯定，我不確定來源是不是官方。', en: 'A confident message about a school or consumer offer arrives in the parent group, but I do not know if the source is official.' },
      action: { zh: '直接向學校或服務提供者確認條件，再決定要不要轉給其他家長', en: 'check the terms with the school or provider before passing the message to other parents' },
      cost: { zh: '要多花時間問清楚，也可能錯過早鳥優惠，但不會把未證實的話當通知', en: 'checking takes time and may miss an early offer, but an unchecked message is not treated as an official notice' },
    },
    attention: {
      situation: { zh: '我和孩子規劃家庭出遊時，不想只選最便宜的行程，還要知道孩子真正想一起做什麼。', en: 'When planning a family outing, I do not want to pick only the cheapest option; I want to know what my child wants to do together.' },
      action: { zh: '先問孩子最期待哪個活動，再一起挑能留下共同回憶的安排', en: 'ask what my child is most excited about, then choose something we can remember together' },
      cost: { zh: '討論會比直接比價久一點，也可能得放棄最便宜的方案', en: 'the discussion takes longer than price comparison, and we may pass on the cheapest option' },
    },
    understanding: {
      situation: { zh: '孩子說作業做完了，我還不知道他是理解了，還是把 AI 給的答案貼上去。', en: 'My child says the homework is done, but I do not know whether they understood it or pasted an AI answer.' },
      action: { zh: '請孩子用自己的話講一遍，再一起找出他想不通的地方', en: 'ask my child to explain it in their own words, then find what remains confusing together' },
      cost: { zh: '要留時間聽孩子說，也不能只用完成速度判斷學會了沒有', en: 'I need time to listen and cannot use speed alone to judge learning' },
    },
    delegation: {
      situation: { zh: '行程 Agent 推薦了孩子沒興趣、時間也不合的家庭活動，我不想讓它直接訂位。', en: 'A trip agent suggests an activity my child dislikes and a time that does not work, so I will not let it book.' },
      action: { zh: '先讓 Agent 列出可選活動，再和孩子確認偏好、時間與是否需要預約', en: 'let the agent list options, then check preferences, timing, and booking needs with my child' },
      cost: { zh: '最後仍要家庭成員一起確認，少掉的是搜尋時間，不是共同決定', en: 'the family still decides together; the agent saves search time, not the conversation' },
    },
  },
  cyclist: {
    trust: {
      situation: { zh: '導航建議一段看起來很快的路，卻不確定是不是有施工或不適合自行車。', en: 'Navigation suggests a fast segment, but I do not know if it is under construction or unsafe for bicycles.' },
      action: { zh: '先查官方路況和車友回報，遇到資訊不一致就改走熟悉的安全路段', en: 'check official road information and rider reports, then choose a familiar safe route if they conflict' },
      cost: { zh: '路程可能變長，也得多查一次，但不拿速度換不確定的路況', en: 'the ride may take longer and needs another check, but speed does not override uncertain road conditions' },
    },
    attention: {
      situation: { zh: '我在安排車友團騎時，平均速度很漂亮，卻可能讓新手和老手沒有一起完成的記憶。', en: 'A fast group-ride average can look good but leave newer and experienced riders with no shared moment.' },
      action: { zh: '選一條安全路線和大家都能停下來的補給點，不把競速紀錄當唯一成功標準', en: 'choose a safe route and a rest stop for everyone instead of treating speed as the only measure of success' },
      cost: { zh: '需要多協調集合和配速，總時間也可能增加', en: 'meeting and pacing take more coordination, and the ride may take longer' },
    },
    understanding: {
      situation: { zh: '碼表顯示車隊速度正常，還是有人一直落隊，我不清楚是坡度、車況還是配速問題。', en: 'The average speed looks fine, but riders keep falling behind and I do not know whether it is terrain, gear, or pace.' },
      action: { zh: '問落隊車友在哪段最吃力，再對照路線、坡度和停留紀錄找原因', en: 'ask where riders struggle and compare the route, elevation, and stop records' },
      cost: { zh: '要聽個別經驗，不能只靠一個平均數就調整整隊路線', en: 'individual accounts take time, and one average cannot settle the route choice' },
    },
    delegation: {
      situation: { zh: '路線 Agent 很會排時間，卻不能替我判斷未知路段當天能不能安全騎。', en: 'A route agent estimates timing well but cannot decide whether an unfamiliar road is safe that day.' },
      action: { zh: '請它整理幾條路線選項，再由車友核對路況、天氣和折返點', en: 'ask it for route options, then have riders check road conditions, weather, and turn-back points' },
      cost: { zh: '人工檢查仍在，不能把導航建議直接當成安全保證', en: 'human checks remain; a navigation suggestion is not a safety guarantee' },
    },
  },
  gardener: {
    trust: {
      situation: { zh: '植物辨識 App 說葉片有病蟲害，還推薦要噴藥，我不確定這是不是看錯。', en: 'A plant app labels a leaf as diseased and recommends a spray, but I am unsure it got the diagnosis right.' },
      action: { zh: '先和在地園藝人員或可信資料核對，再決定是否在食用區處理', en: 'check with a local gardening source before treating a food-growing area' },
      cost: { zh: '處理會延後，也得多觀察幾天，但不會把可能的誤判直接噴進菜園', en: 'treatment is delayed and needs more observation, but a possible misdiagnosis is not sprayed onto the garden' },
    },
    attention: {
      situation: { zh: '社區花圃想辦成果日，我不想只數來了多少人，也想讓鄰居記得一起種過什麼。', en: 'For a community garden day, I want neighbors to remember what they grew together, not only how many showed up.' },
      action: { zh: '讓鄰居分享一種植物的照顧故事，留一塊大家能接著種的區域', en: 'invite neighbors to share a plant-care story and leave a space they can keep growing together' },
      cost: { zh: '要花時間一起整理故事和照護安排，成果也不會只看當天人數', en: 'stories and care plans take time, and attendance alone will not measure the result' },
    },
    understanding: {
      situation: { zh: '社區花圃只有一小塊試種區長得好，我還不知道其他日照和土壤不同的花床會不會一樣。', en: 'One trial patch grows well, but other beds have different light and soil, so I do not know if the result generalizes.' },
      action: { zh: '按日照和土壤分開記錄幾個花床的反應，再決定能不能把做法推廣', en: 'record several beds by sunlight and soil before deciding whether to extend the method' },
      cost: { zh: '需要跨區觀察一段時間，不能用一小塊樣本替整座花園下結論', en: 'observing several areas takes time; one small sample cannot stand for the whole garden' },
    },
    delegation: {
      situation: { zh: '灌溉 Agent 可以照天氣排程，但不知道有一塊花床剛下過雨或土壤還很濕。', en: 'An irrigation agent can follow the forecast but may not know one bed already had rain or wet soil.' },
      action: { zh: '先讓它提醒天氣和排程，由園丁摸土確認後再決定是否開水', en: 'use it for weather and schedule reminders, then check the soil before turning on water' },
      cost: { zh: '自動化停在提醒這一步，還要人工照看局部變化', en: 'automation stops at reminders and still needs someone to check local changes' },
    },
  },
  worker: {
    trust: {
      situation: { zh: 'Agent 幫我彙整客戶資料，卻沒有說明讀了哪些帳戶、資料是不是最新。', en: 'An agent summarizes customer data but does not show which accounts it read or whether the data is current.' },
      action: { zh: '要求它列出來源、更新時間、缺漏和信心，再由負責同事確認後轉交', en: 'require sources, update times, gaps, and confidence, then have an owner review it before handoff' },
      cost: { zh: '覆核會多花幾分鐘，報告也可能要先補資料再交付', en: 'review takes extra time, and the report may need data work before delivery' },
    },
    attention: {
      situation: { zh: '我要向同事說明一項流程改變，不想把簡報塞滿自動生成的進度圖卻沒說明影響誰。', en: 'I need to explain a process change and do not want generated progress charts to hide who is affected.' },
      action: { zh: '先說清楚一位同事或顧客實際遇到的改變，再挑少量資料支持它', en: 'start with how one colleague or customer is affected, then use only the data that supports it' },
      cost: { zh: '內容會少一些，得另外聽使用者經驗並確認細節', en: 'the deck is shorter and needs someone to verify the user experience' },
    },
    understanding: {
      situation: { zh: '專案轉換率上升，客服補件和退款也增加，我不清楚是哪個步驟讓顧客卡住。', en: 'Project conversion rises while support requests and refunds increase, and I do not know where customers get stuck.' },
      action: { zh: '把漏斗和後續問題放在一起看，跟客服和顧客核對出錯的步驟', en: 'read funnel and downstream issues together, then check the failure point with support staff and customers' },
      cost: { zh: '要多追一段時間和幾個指標，不能只用一週的轉換率結案', en: 'more time and measures are needed instead of closing on one week of conversion' },
    },
    delegation: {
      situation: { zh: '團隊想把工作交給 Agent，但資料能否使用、錯誤由誰接手都還沒有定義。', en: 'The team wants an agent to take on work, but data permissions and error ownership are undefined.' },
      action: { zh: '先選一個容易撤回的任務，列清楚資料權限、負責人和轉人工條件', en: 'start with a reversible task and specify data permissions, an owner, and human handoff rules' },
      cost: { zh: '要先補資料和責任流程，能自動化的範圍一開始會比較小', en: 'data and ownership work comes first, so initial automation is narrower' },
    },
  },
  traveler: {
    trust: {
      situation: { zh: '行程 Agent 說景點有開、交通照常，我還沒在官方網站找到當天公告。', en: 'A trip agent says a site is open and transit is normal, but I have not found that day’s official notice.' },
      action: { zh: '回官方交通和景點資訊確認，再訂不能取消的住宿或門票', en: 'check official transit and venue information before booking anything non-refundable' },
      cost: { zh: '要多查一次，也可能得臨時改路線，但不拿一張訂單賭資訊正確', en: 'another check may force a route change, but a booking does not prove the information was right' },
    },
    attention: {
      situation: { zh: '同行者列出很多必去景點，我怕行程都在打卡，沒留下一段大家真的想回憶的時間。', en: 'My travel group lists many must-see sights, and I worry the trip will be check-ins with no shared memory.' },
      action: { zh: '問每個人最想共同體驗的一件事，留出可以慢下來的行程空檔', en: 'ask everyone for one shared experience they want and leave time to enjoy it' },
      cost: { zh: '會少排幾個景點，也得協調不同人的期待', en: 'we see fewer sights and need to work through different expectations' },
    },
    understanding: {
      situation: { zh: '行程工具建議的轉乘時間看起來足夠，同行長者和孩子卻可能走不完那段路。', en: 'An itinerary gives enough transfer time on paper, but older relatives and children may not manage the walk.' },
      action: { zh: '把同行者步行速度、休息和行李條件放進去，再用官方時刻表核對', en: 'account for walking pace, breaks, and luggage, then check the official schedule' },
      cost: { zh: '要為每個人多留緩衝，行程可能排得沒有那麼緊湊', en: 'more buffer for everyone makes the itinerary less tightly packed' },
    },
    delegation: {
      situation: { zh: '旅遊 Agent 能整理機票和住宿選項，但不能替同行者確認預算、無障礙需求或退款規則。', en: 'A travel agent can list flights and stays but cannot confirm everyone’s budget, access needs, or refund terms.' },
      action: { zh: '讓它先比選項，由同行者核對需求和取消規則後才確認訂位', en: 'let it compare options, then have travelers check needs and cancellation terms before booking' },
      cost: { zh: '最後一步仍要一起確認，省下搜尋時間但保留人的決定權', en: 'the group still confirms the final step, saving search time while keeping people in control' },
    },
  },
};

export const NPC_SCENARIO_BOOK_TITLE = '決策智慧 2026｜Agentic 時代，重塑品牌與人的真實距離';

export const NPC_ARTICLE_SCENARIOS: readonly NpcArticleScenario[] = [
  {
    articleId: '2026-01',
    expectedTitle: 'AI for Growth 看懂世界，加速成長',
    family: 'delegation',
    anchor: { zh: '效率要換成顧客價值', en: 'turning efficiency into customer value' },
    issue: { zh: '景氣不明時，大家只想砍成本，卻還沒說清楚顧客真正需要什麼', en: 'when the outlook is uncertain, everyone wants to cut cost before agreeing on what customers need' },
    point: { zh: 'AI 可以加快學習，最後的判斷和資料界線仍要由人負責', en: 'AI can speed up learning, while people still own judgment and data boundaries' },
    action: { zh: '先挑一個能替使用者解決問題的小範圍試做，寫下成效指標、可用資料和人工覆核人', en: 'start with a small test that solves a user problem, and name its outcome, allowed data, and human reviewer' },
    tradeoff: { zh: '要多花時間做資料檢查和回看成果，不能一開始就把預算全押在自動化', en: 'it takes time to check data and review results, so the budget cannot go straight into automation' },
  },
  {
    articleId: '2026-02',
    expectedTitle: 'Agentic 時代 品牌與人的真實距離',
    family: 'understanding',
    anchor: { zh: '持續研究與真人校準', en: 'continuous research with human calibration' },
    issue: { zh: '新客群或新說法還沒研究完，市場上的決定卻不能一直等', en: 'a decision about a new audience or message cannot wait for every research round to finish' },
    point: { zh: 'Agent 可以持續整理假設和資料，但陌生情境仍要真人校準', en: 'an agent can keep organizing hypotheses and data, but unfamiliar situations still need human calibration' },
    action: { zh: '把大問題拆成幾個可回答的假設，先用已有資料找方向，再請真實使用者檢查陌生或反常的部分', en: 'break the big question into answerable hypotheses, use available data for direction, then ask real people to check unfamiliar or unusual parts' },
    tradeoff: { zh: '回饋會比較快，但要留一段時間找真人核對，不能把模擬反應當成真實購買行為', en: 'feedback arrives sooner, but human checks still take time and simulated reactions are not real purchase behavior' },
  },
  {
    articleId: '2026-03',
    expectedTitle: '真實的力量 重新定義中',
    family: 'attention',
    anchor: { zh: '真實感和情感認同', en: 'authenticity and emotional connection' },
    issue: { zh: '大家都用相似工具後，作品看起來完整，卻聽不出是誰的聲音', en: 'when everyone uses similar tools, work may look polished but lose its own voice' },
    point: { zh: '可複製的功能會趨同，人的真實經驗和情感才留下辨識度', en: 'replicable features converge, while lived human experience and emotion remain distinctive' },
    action: { zh: '保留一個真實人物的說法或不完美細節，讓它能被當事人認出來，不用 AI 把每個稜角磨平', en: 'keep a real person’s words or an imperfect detail that they would recognize instead of smoothing every edge with AI' },
    tradeoff: { zh: '這樣比較難套用同一套格式大量製作，但也不會為了整齊把情感和個性刪掉', en: 'this is harder to mass-produce in one format, but it keeps personality and emotion from being edited away' },
  },
  {
    articleId: '2026-04',
    expectedTitle: 'Agents of Growth AI 代理時代的增長推手',
    family: 'attention',
    anchor: { zh: '演算法、人心與文化三個面向', en: 'algorithm, people, and culture' },
    issue: { zh: '品牌計畫做了很多項目，卻不清楚缺的是被系統讀懂、被人信任，還是進入文化參與', en: 'a brand plan has many activities but cannot tell whether it lacks machine readability, human trust, or cultural participation' },
    point: { zh: '增長要同時顧到演算法能否理解、人的信任和文化參與', en: 'growth depends on machine understanding, human trust, and cultural participation together' },
    action: { zh: '先用這三個面向逐一盤點，再選一項最明顯的缺口負責試做，不急著再添一個工具或合作方', en: 'review all three areas, choose the clearest gap for a test, and resist adding another tool or partner by default' },
    tradeoff: { zh: '跨團隊需要多花時間對齊方向和負責人，但可以減少彼此交接卻沒人接住顧客的情況', en: 'teams spend more time aligning direction and ownership, but fewer customer needs fall between handoffs' },
  },
  {
    articleId: '2026-05',
    expectedTitle: 'AI 代理時代的增長架構師',
    family: 'understanding',
    anchor: { zh: '表面指標背後的真實成長課題', en: 'the real growth problem behind a surface metric' },
    issue: { zh: '看見一個數字變差就想改文案或買工具，還不知道問題出在哪裡', en: 'a weak metric prompts a copy change or a new tool before anyone knows the real problem' },
    point: { zh: '先理解人的真實動機和成長障礙，再選策略和工具', en: 'understand people’s real motives and growth barriers before choosing strategy or tools' },
    action: { zh: '把眼前的症狀改寫成一個使用者問題，訪談當事人並檢查行為資料後再決定要改哪一段', en: 'rewrite the symptom as a user problem, talk to the people involved, and inspect behavior data before choosing what to change' },
    tradeoff: { zh: '多一輪提問會延後交付，但能避免很快完成一個沒有解決問題的改版', en: 'another round of questions delays delivery, but avoids quickly shipping a change that solves nothing' },
  },
  {
    articleId: '2026-06',
    expectedTitle: '信任 為何成為 AI 時代最難複製的競爭力',
    family: 'trust',
    anchor: { zh: '內容的成本轉到查證', en: 'verification as the new cost of content' },
    issue: { zh: '一段 AI 整理的內容讀起來很肯定，卻找不到足夠來源確認', en: 'AI-written content sounds certain, but there are not enough sources to verify it' },
    point: { zh: '內容容易生成，信任要靠可追溯的查證建立', en: 'content is easy to generate; trust comes from traceable verification' },
    action: { zh: '對重要主張找原始資料和另一方的說法交叉核對，查不到就先不寫成事實', en: 'check important claims against primary material and another perspective, and do not state them as fact if they cannot be verified' },
    tradeoff: { zh: '核對會拖慢發布，也可能讓一段吸引人的說法暫時拿掉，但能避免把可信度押在語氣上', en: 'verification slows publication and may remove a compelling line, but it avoids mistaking confident wording for proof' },
  },
  {
    articleId: '2026-07',
    expectedTitle: 'AI 可以幫人買東西 但品牌要讓人想買東西',
    family: 'attention',
    anchor: { zh: '交易比較和情緒動機是兩件事', en: 'transaction comparison and emotional motivation' },
    issue: { zh: '推薦系統很快列出最划算的選項，卻沒說明人為什麼會特別想要其中一個', en: 'a recommender quickly ranks the best deal but misses why someone might want one option in particular' },
    point: { zh: 'AI 可以處理交易比較，品牌還要在比較前創造購買動機', en: 'AI can compare transactions, while a brand still has to create a reason to want something before comparison' },
    action: { zh: '先問使用者想完成什麼、在意什麼，再檢查內容是否說出這個理由，而不只列規格和價格', en: 'ask what the person wants to do and cares about, then check whether the message expresses that reason instead of listing only specs and price' },
    tradeoff: { zh: '了解動機比直接排價錢花時間，也不一定馬上換成一次成交，但能避免把喜歡簡化成最便宜', en: 'understanding motivation takes longer than sorting by price and may not produce an immediate sale, but it keeps preference from being reduced to the cheapest option' },
  },
  {
    articleId: '2026-08',
    expectedTitle: '當注意力成為稀缺資源 娛樂與運動如何累積品牌心智資產？',
    family: 'attention',
    anchor: { zh: '從曝光聲量走向文化參與', en: 'from exposure share to cultural participation' },
    issue: { zh: '活動有很多人看見，散場後卻沒留下可以一起回想的事', en: 'many people see a campaign, but leave with nothing to remember together' },
    point: { zh: '娛樂和運動能用真實情緒與參與累積共同記憶', en: 'entertainment and sport build shared memories through real emotion and participation' },
    action: { zh: '找一個社群願意一起玩的內容或儀式，讓參與者能補上自己的故事，再看他們是否願意回來', en: 'find a story or ritual people want to join, leave room for their own contribution, and see whether they return' },
    tradeoff: { zh: '需要長時間經營和文化理解，不能保證立刻觸及更多人，但留下的不只是一次曝光', en: 'it needs cultural understanding and sustained effort and may not immediately reach more people, but it builds more than a single impression' },
  },
  {
    articleId: '2026-09',
    expectedTitle: '討好演算法，還是打動人？別讓效率邏輯把社群砍掉',
    family: 'attention',
    anchor: { zh: '讓資訊可被讀到，也讓人願意轉述', en: 'make information readable and worth sharing' },
    issue: { zh: '貼文看起來很符合平台格式，卻沒有任何人想用自己的話談它', en: 'posts fit the platform format but give people nothing they want to discuss in their own words' },
    point: { zh: '內容要讓 AI 抓得到具體資訊，也要讓真人感到有共鳴', en: 'content should give AI concrete information to retrieve and give people a reason to relate' },
    action: { zh: '用一個真實使用情境說清楚重點和證據，再留出社群分享經驗的空間，不用大量制式貼文填滿版面', en: 'explain the point and its evidence through a real use situation, then leave room for people to share rather than filling the feed with templated posts' },
    tradeoff: { zh: '真實討論長得比較慢，也無法完全控制大家怎麼說，但批量產出的空泛好評更難換來信任', en: 'real discussion grows more slowly and cannot be fully controlled, but bulk generic praise earns less trust' },
  },
  {
    articleId: '2026-10',
    expectedTitle: '別買曝光了，開始買注意力吧 把媒體做成體驗，幫品牌累積「滑不走」的記憶資產',
    family: 'attention',
    anchor: { zh: '出現在畫面和被人看進去不同', en: 'being visible is different from being noticed' },
    issue: { zh: '報表顯示內容有曝光，大家卻說不出記得什麼', en: 'the report shows impressions, but people cannot say what they remember' },
    point: { zh: '可視率不等於有效注意，觀看時間和回想更接近記憶品質', en: 'viewability is not effective attention; time spent and recall better reflect memory quality' },
    action: { zh: '先做一個能讓人停下來參與的小測試，同時記錄觀看時間、回想和平台曝光，不只看畫面有沒有出現', en: 'test one small experience that invites people to pause, and track time spent and recall alongside impressions' },
    tradeoff: { zh: '高注意力的體驗可能觸及較少人或單次成本較高，但能看出內容是否真的被記住', en: 'a high-attention experience may reach fewer people or cost more per contact, but it shows whether the message is remembered' },
  },
  {
    articleId: '2026-11',
    expectedTitle: '從金曲獎到甄嬛傳 共同記憶帶來的品牌價值',
    family: 'attention',
    anchor: { zh: '共同符碼和儀式讓社群重聚', en: 'shared symbols and rituals bring communities back together' },
    issue: { zh: '合作活動當天很熱鬧，品牌卻像路過一下，沒有進入大家共同的記憶', en: 'a partnership draws a crowd for a day, but the brand never becomes part of what people remember together' },
    point: { zh: '品牌要加入社群已有的語言和儀式，才能搭起不同受眾的共同記憶', en: 'a brand builds common ground by joining a community’s language and rituals' },
    action: { zh: '先聽社群平常怎麼說、每年怎麼聚，再設計一個讓不同世代都能補充回憶的參與點', en: 'listen to how the community speaks and gathers, then create a moment where different generations can add their memories' },
    tradeoff: { zh: '需要時間理解社群，也得放手讓參與者補寫細節，不像買版位那樣可以完全控制', en: 'it takes time to understand a community and leaves participants room to shape the story, so it is less controllable than buying placements' },
  },
  {
    articleId: '2026-12',
    expectedTitle: '<特別企劃> People Model 讓消費者研究 變成一場隨時能開口的對話',
    family: 'understanding',
    anchor: { zh: '把直接支持、模型估計和情境模擬分開', en: 'separate direct evidence, model estimates, and simulations' },
    issue: { zh: '模型很快給出消費者反應，但手上的樣本沒有涵蓋這種新情境', en: 'a model quickly predicts consumer reactions, but the available sample does not cover this new situation' },
    point: { zh: '模擬可以幫忙形成問題，不能冒充資料直接支持的洞察', en: 'a simulation can help frame a question, but it is not an insight directly supported by data' },
    action: { zh: '把結論標成資料支持、模型估計或情境模擬，再用真人訪談或合適資料校準陌生部分', en: 'label conclusions as data-supported, model-estimated, or simulated, then use interviews or relevant data to calibrate unfamiliar parts' },
    tradeoff: { zh: '真人校準會拉長決策時間，也讓結論沒那麼俐落，但不會把證據不足包裝成精確答案', en: 'human calibration slows a decision and makes the conclusion less tidy, but it avoids dressing up weak evidence as a precise answer' },
  },
  {
    articleId: '2026-13',
    expectedTitle: '重建 SOV：在注意力被 AI 稀釋的時代，如何守住品牌被選擇的關鍵場域',
    family: 'attention',
    anchor: { zh: 'Share of Choice Context 選擇情境占位', en: 'Share of Choice Context' },
    issue: { zh: '曝光和搜尋指標變好，顧客在真正選擇時仍想不起這個品牌', en: 'exposure and search metrics improve, but customers still do not recall the brand at decision time' },
    point: { zh: '品牌要看自己是否出現在顧客做選擇的系統、社群和記憶裡', en: 'a brand must show up in the systems, communities, and memories where people make choices' },
    action: { zh: '先找出顧客從哪裡開始比較，再分別檢查平台或門市可見度、社群推薦和品牌回想', en: 'find where people begin comparing, then check platform or store visibility, community recommendation, and brand recall separately' },
    tradeoff: { zh: '訊號比較分散、歸因也不如單一 ROAS 俐落，但不會把所有選擇都誤認為線上搜尋帶來', en: 'signals are scattered and harder to attribute than one ROAS figure, but not every choice is mistaken for a search-driven one' },
  },
  {
    articleId: '2026-14',
    expectedTitle: 'AI 普及下的演算法世代 衡斷力 Judgment 將成為最稀缺的競爭力',
    family: 'trust',
    anchor: { zh: '生成和核實是兩回事', en: 'generation and verification are different jobs' },
    issue: { zh: 'AI 把一個答案說得很肯定，資料卻不足以讓任何人負責任地採用', en: 'AI states an answer with confidence, but the evidence is too thin for anyone to adopt it responsibly' },
    point: { zh: 'AI 擅長生成，不會替人保證正確；最後判斷仍要由人承擔', en: 'AI can generate an answer but cannot guarantee it is right; a person still owns the final judgment' },
    action: { zh: '先把生成內容當成待查假設，核對來源、資料盲點和可能的反例，再由有責任的人決定方向', en: 'treat generated content as a hypothesis, check sources, gaps, and counterexamples, then let an accountable person choose the direction' },
    tradeoff: { zh: '多一輪審查會減慢決定，也需要懂情境的人投入時間，但不能把簽名責任交給生成器', en: 'another review slows the decision and needs an informed person, but accountability cannot be handed to a generator' },
  },
  {
    articleId: '2026-15',
    expectedTitle: '生成式體驗來臨 誰能掌握顧客的下一步？',
    family: 'understanding',
    anchor: { zh: '從旅程地圖找到決策斷點', en: 'find decision breaks in the customer journey' },
    issue: { zh: '顧客走到下一個頁面就停住，現有推薦沒有回應他正在猶豫的事', en: 'customers stop at the next step because a generic recommendation misses what they are weighing' },
    point: { zh: '體驗要找到猶豫的決策點，再提供合乎情境的下一步', en: 'an experience should locate the hesitation point and offer a next step that fits the situation' },
    action: { zh: '觀察顧客在哪個選擇停下，補上適用情境、限制和服務方式，並保留找真人協助的路徑', en: 'observe where people pause, add relevant situations, limits, and service options, and keep a route to human help' },
    tradeoff: { zh: '要整理更完整的商品或服務資料，不能只靠推薦模型，但顧客不必自己猜下一步', en: 'this needs fuller product or service information, not only a recommender, but customers do not have to guess what comes next' },
  },
  {
    articleId: '2026-16',
    expectedTitle: '贏在 AI 時代的隱形戰場 看見「文化暗流」，啟動企業真實的轉型動能',
    family: 'delegation',
    anchor: { zh: '工具表現之外的文化暗流', en: 'the cultural undercurrents beneath tool adoption' },
    issue: { zh: '公司買了 AI 工具，第一線同事仍不確定工作會怎麼變、節省的時間要拿來做什麼', en: 'the company has AI tools, but frontline staff do not know how their work will change or how to use the time saved' },
    point: { zh: '轉型不只看工具數量，也要處理員工的顧慮、權力和協作方式', en: 'transformation depends on staff concerns, power, and collaboration as well as tools' },
    action: { zh: '先分別聽管理者和第一線說明卡點，再把省下的時間要用在哪裡、誰支援學習說清楚', en: 'hear blockers from managers and frontline staff separately, then explain where saved time goes and who supports learning' },
    tradeoff: { zh: '要花時間面對不舒服的問題並安排培訓，工具擴大的速度會慢一些，但抵抗不會被誤當成懶惰', en: 'addressing uncomfortable questions and arranging training takes time, but resistance is not mistaken for laziness' },
  },
  {
    articleId: '2026-17',
    expectedTitle: '顧客為何停下來？從洞察到治理的體驗優化',
    family: 'understanding',
    anchor: { zh: '把轉換和後續風險一起看', en: 'read conversion together with downstream risk' },
    issue: { zh: '結帳變快、完成率上升，後續的退貨、補件和客服卻跟著增加', en: 'checkout gets faster and completion rises, but returns, extra requests, and support contacts increase later' },
    point: { zh: '體驗優化要持續驗證，也要把風險指標和轉換一起衡量', en: 'experience optimization needs ongoing validation and risk measures alongside conversion' },
    action: { zh: '先在一小段旅程試改版，同時記錄完成率、取消、退貨和求助，再決定是否擴大', en: 'test one part of the journey and track completion, cancellations, returns, and help requests before expanding' },
    tradeoff: { zh: '需要多等一段時間看後續結果，短期轉換可能沒有最漂亮，但省下事後清理問題的成本', en: 'you wait longer for downstream results and short-term conversion may look less impressive, but avoid cleanup later' },
  },
  {
    articleId: '2026-18',
    expectedTitle: '體驗這件事，我們一直只問了一半',
    family: 'trust',
    anchor: { zh: '意圖預覽、自主性調節和升級路徑', en: 'intent preview, autonomy controls, and escalation paths' },
    issue: { zh: 'Agent 做完一串任務，使用者不知道它讀了什麼資料，也看不見漏了哪一步', en: 'an agent completes a task, but the user cannot see what it read or whether it missed a step' },
    point: { zh: 'Agent 要讓人看懂意圖和動作、能調整授權，並可在複雜情況轉交真人', en: 'an agent should make its intent and actions visible, allow autonomy controls, and hand off complex cases' },
    action: { zh: '先讓系統預告要讀取和執行的項目、留下可查紀錄，遇到交叉規則就停下來請人接手', en: 'show what the system will read and do, keep an audit trail, and stop for a person when rules intersect' },
    tradeoff: { zh: '確認和轉接會多花幾步，也不是每件事都能無人完成，但使用者看得到發生什麼、錯了能追查', en: 'confirmation and handoffs add steps and some tasks remain human-led, but users can see what happened and investigate errors' },
  },
  {
    articleId: '2026-19',
    expectedTitle: 'GEO 時代 被 AI 看見是技術，被消費者記住才是本事',
    family: 'attention',
    anchor: { zh: '從關鍵字轉向需求情境', en: 'move from keywords to need situations' },
    issue: { zh: '品牌資料被 AI 引用，讀者看完答案仍分不清它和相似品牌有什麼不同', en: 'AI cites the brand, but readers still cannot tell it apart from similar brands' },
    point: { zh: '被 AI 找到只是第一步，還要在真實需求情境裡讓人記得', en: 'being found by AI is only the first step; the brand also needs to be memorable in a real need situation' },
    action: { zh: '先描述消費者何時會遇到需求，再放入可查的具體經驗或證據，檢查 AI 是否保留了差異', en: 'describe when the need occurs, add concrete verifiable experience or evidence, and check whether AI preserves the distinction' },
    tradeoff: { zh: '需要採訪和整理有特色的內容，不能靠一套關鍵字快速複製，但比較不會被濃縮成公版答案', en: 'distinctive content takes reporting and work rather than quick keyword reuse, but is less likely to collapse into a generic answer' },
  },
  {
    articleId: '2026-20',
    expectedTitle: '拒絕同質化 AI Slop 將 AI 的「生成力」升級為品牌的「交付力」',
    family: 'trust',
    anchor: { zh: '規格、產線、檢驗和可重用模式', en: 'specification, production line, inspection, and reusable patterns' },
    issue: { zh: '草稿產量變多，團隊卻反覆花時間修正品牌不符、授權或品質問題', en: 'drafts multiply while the team keeps repairing brand, licensing, and quality problems' },
    point: { zh: '生成能力要接上規格、產線和檢驗，才會成為穩定交付', en: 'generation becomes dependable delivery only when paired with specifications, production, and inspection' },
    action: { zh: '先寫清楚不能妥協的品牌與授權規格，重用核准素材，並設人工檢驗關卡再發布', en: 'write the non-negotiable brand and rights rules, reuse approved components, and add a human inspection before release' },
    tradeoff: { zh: '前面要花時間建規格和檢驗，單次產出不會最快，但少掉後面修補和信任損耗', en: 'building specifications and checks takes time up front, but reduces later repairs and lost trust' },
  },
  {
    articleId: '2026-21',
    expectedTitle: '超越效率 解碼 AI 製作驅動的創意代理商',
    family: 'delegation',
    anchor: { zh: '在地文化資料和多工具製作流程', en: 'local cultural context and a multi-tool production workflow' },
    issue: { zh: '一句提示詞產出很多素材，卻放錯了各地的語氣或文化線索', en: 'one prompt produces many assets but misses local voice or cultural context' },
    point: { zh: 'AI 原生製作靠規則、工具串接和創意人共同把關，不是只靠一句提示詞', en: 'AI-native production combines rules, connected tools, and creative direction rather than one prompt' },
    action: { zh: '先整理每個市場的語境和品牌限制，讓創意人挑選並修正一小批素材，確認後再擴大製作', en: 'document each market’s context and brand limits, have creatives review a small batch, then scale after approval' },
    tradeoff: { zh: '要先整理素材規則和培養製作能力，前期準備較重，但不會為了產量犧牲在地感和質感', en: 'rules and production skills need upfront work, but local relevance and craft are less likely to be sacrificed for volume' },
  },
  {
    articleId: '2026-22',
    expectedTitle: 'AI Agent 走進消費旅程 保健、美妝與零售如何把 AI 變成行動能力',
    family: 'delegation',
    anchor: { zh: '先選任務，再界定 Agent 權限', en: 'choose the task before setting agent permissions' },
    issue: { zh: '大家都想導入 Agent，卻還沒決定哪些資料可靠、出錯時誰接手', en: 'everyone wants an agent, but no one has agreed which data is reliable or who handles mistakes' },
    point: { zh: '先選低風險任務，分清觀察、推薦、決策和行動的權限', en: 'start with a low-risk task and separate observe, recommend, decide, and act permissions' },
    action: { zh: '挑一個容易檢查和修正的任務，補齊資料與責任人，再明確寫下何時停下轉交人工', en: 'choose an easy-to-check and reversible task, prepare its data and owner, and define when to stop and hand off' },
    tradeoff: { zh: '先限制自主權並整理資料會讓上線慢一點，但能避免 Agent 把原有的資料缺漏和流程混亂放大', en: 'limited autonomy and data cleanup slow launch, but keep an agent from amplifying existing data gaps and process confusion' },
  },
];
