import type { Edition } from './types';
import type { I18nText, JourneyAudienceId, JourneyConnectionKind, JourneyDefinition, JourneyPersonaDefinition, JourneyQuestionDefinition, JourneyStepDefinition, ReadingJourneys } from './journey-types';
import { MISSION_ROUNDS } from './journey-mission-content';
import { MISSION_VISUALS } from './mission-visual-content';
import { MISSION_3D_ACTIONS } from './mission-3d-actions';
import { validateMissionVisual } from './mission-visual-validation';

const t = (zh: string, en: string): I18nText => ({ zh, en });
const step = (articleOrder: number, prompt: I18nText, reason: I18nText, kind?: JourneyConnectionKind, explanation?: I18nText): JourneyStepDefinition => ({
  articleOrder, prompt, reason, ...(kind && explanation ? { connection: { kind, explanation } } : {}),
});
const question = (id: string, title: I18nText, why: I18nText, steps: JourneyStepDefinition[]): JourneyQuestionDefinition => ({ id, title, why, steps });
const persona = (id: string, audienceId: JourneyAudienceId, title: I18nText, description: I18nText, icon: string, questions: JourneyQuestionDefinition[]): JourneyPersonaDefinition => ({ id, audienceId, title, description, icon, questions });

const READING_2026: JourneyDefinition = {
  bookId: '決策智慧 2026｜Agentic 時代，重塑品牌與人的真實距離',
  year: 2026,
  audiences: [
    { id: 'marketing', title: t('行銷工作', 'Marketing work'), description: t('從品牌、創意、媒體與團隊決策，找到工作上的閱讀起點。', 'Find a starting point in brand, creative, media and team decisions.'), icon: '✦' },
    { id: 'everyday', title: t('日常生活', 'Everyday life'), description: t('從家庭、職場與日常選擇，連結書中的人與 AI 議題。', 'Connect the book’s themes of people and AI with family, work and everyday choices.'), icon: '⌂' },
  ],
  notice: t('這本書聚焦品牌、人與 AI。角色路線是本站編輯導讀，可自由跳讀。', 'This book explores brands, people and AI. These reading paths are editorial guides. Choose any perspective and read at your own pace.'),
  personas: [
    persona('family', 'everyday', t('家長／家庭觀察者', 'Parent / family observer'), t('從家人共享的內容與信任，看懂品牌如何走進日常。', 'Explore how shared content and trust bring brands into family life.'), '⌂', [
      question('shared-memory', t('為什麼家人會被不同內容打動？', 'Why does different content move each generation?'), t('從跨世代共同記憶，看見熟悉感與新文化各自的作用。', 'Shared memories offer a way to compare familiarity and emerging culture.'), [
        step(11, t('什麼內容讓不同世代聚在一起？', 'What brings generations together?'), t('金曲獎與甄嬛傳案例呈現共同記憶如何形成。', 'Music awards and shared viewing show how common memories form.')),
        step(8, t('年輕人為什麼投入粉絲文化？', 'Why invest in fan culture?'), t('娛樂、運動與 IP 補上參與和認同的視角。', 'Entertainment, sport and IP add participation and identity.'), 'complement', t('從熟悉的共同記憶，延伸到正在形成的新認同。', 'Pair established shared memories with new forms of identity.')),
        step(7, t('喜歡怎麼變成想買？', 'How does liking turn into wanting?'), t('社群商務拆開情緒共鳴與購買動機。', 'Social commerce separates emotional resonance from purchase motivation.'), 'context', t('把文化參與放回品牌希望促成消費的情境看。', 'Place cultural participation in the context of brands seeking purchases.')),
      ]),
      question('family-trust', t('AI 內容這麼多，怎麼談可信度？', 'How can we discuss trust amid AI content?'), t('以查證與判斷為談話起點，不把品牌文章當育兒處方。', 'Use verification and judgment as conversation starters, without treating brand essays as parenting prescriptions.'), [
        step(6, t('看起來真，就值得相信嗎？', 'Does looking real make it credible?'), t('新聞查證的經驗讓驗證成本變得具體。', 'Journalistic verification makes the cost of checking concrete.')),
        step(14, t('AI 有答案，我還要判斷什麼？', 'What must I judge when AI has an answer?'), t('感知、連結與衡斷力提供人的能力視角。', 'Sense, connection and judgment describe the human contribution.'), 'complement', t('查證資訊之外，也要練習判斷問題與方向。', 'Verification is complemented by judgment about questions and direction.')),
        step(18, t('交給 AI 前，該知道哪些界線？', 'What boundaries should be visible before delegation?'), t('意圖預覽、行動稽核與人工升級具體呈現信任設計。', 'Intent previews, audit trails and escalation make trust design tangible.'), 'context', t('從個人的判斷，轉看服務本身應提供哪些透明資訊。', 'Move from personal judgment to the transparency a service should offer.')),
      ]),
    ]),
    persona('life-transition', 'everyday', t('人生轉換／退休生活探索者', 'Life transition / retirement explorer'), t('從經驗、世代連結與科技信任重新看自己的位置。', 'Reflect on experience, generational connections and trust in technology.'), '◉', [
      question('experience-value', t('AI 普及後，我的經驗還有什麼價值？', 'What is my experience worth as AI spreads?'), t('書中的工作與品牌觀點，可以作為自我反思的材料。', 'The book’s work and brand perspectives offer material for reflection.'), [
        step(14, t('哪些判斷來自長期累積？', 'Which judgments grow through experience?'), t('文章將經驗與感知放進衡斷力的組成。', 'The essay includes experience and perception in judgment.')),
        step(1, t('人的角色如何隨 AI 改變？', 'How does AI change the human role?'), t('成長視角區分效率、價值與人的責任。', 'A growth perspective distinguishes efficiency, value and human responsibility.'), 'context', t('將個人經驗放進組織重新分工的背景。', 'Place personal experience within changing organizational roles.')),
        step(3, t('真實的人，為什麼仍能打動人？', 'Why do real human stories still move us?'), t('百歲人生與不完美的案例展現真實感的力量。', 'Longevity and imperfection examples explore the force of authenticity.'), 'complement', t('能力之外，再看情感與真實經驗帶來的價值。', 'Add emotional value and lived experience to the capability perspective.')),
      ]),
      question('connection-control', t('如何在新科技中保留連結與自主？', 'How can I keep connection and agency with new technology?'), t('從共同話題走向服務選擇，理解被理解與被代決的差別。', 'Move from shared topics to services, comparing understanding with delegated decisions.'), [
        step(11, t('什麼共同話題能重新連結彼此？', 'What shared topics reconnect people?'), t('跨世代記憶案例讓連結不只停在年齡分類。', 'Cross-generational memories move connection beyond age categories.')),
        step(18, t('方便的服務會交代它在做什麼嗎？', 'Does a convenient service explain its actions?'), t('AX 信任模式說明可見性與控制權。', 'AX trust patterns explain visibility and control.'), 'context', t('從人與人的連結，轉看人與代理服務的信任。', 'Compare interpersonal connection with trust in delegated services.')),
        step(22, t('哪些事情可以交，哪些要自己確認？', 'What can be delegated, and what needs confirmation?'), t('零售與美妝案例對照不同的 AI 權限。', 'Retail and beauty cases compare levels of AI authority.'), 'complement', t('用產業案例對照前篇的透明與自主性設計。', 'Industry cases add concrete comparisons to transparency and autonomy design.')),
      ]),
    ]),
    persona('newcomer', 'everyday', t('職場新鮮人', 'Workplace newcomer'), t('想用好 AI，也想知道自己的判斷與交付價值在哪。', 'Use AI while developing judgment and reliable delivery.'), '◇', [
      question('human-skill', t('AI 都會做了，我該練什麼？', 'What should I learn when AI can do so much?'), t('把問題從工具熟練度，轉向提問、判斷與團隊合作。', 'Move beyond tool fluency to questions, judgment and collaboration.'), [
        step(14, t('答案之外，還缺哪種能力？', 'What capability matters beyond answers?'), t('三項 People Intelligence 能力提供練習方向。', 'Three People Intelligence capabilities suggest learning directions.')),
        step(5, t('怎麼找到真正要解的問題？', 'How do I identify the real problem?'), t('策略工作案例區分表面症狀與成長課題。', 'Strategy examples distinguish symptoms from growth problems.'), 'complement', t('把衡斷力放到具體的提問與策略工作中。', 'Connect judgment with concrete questioning and strategy work.')),
        step(16, t('為何有工具，團隊仍然卡住？', 'Why do teams stall despite having tools?'), t('文化暗流提醒能力還受到分工與組織期待影響。', 'Cultural undercurrents show how roles and expectations affect capability.'), 'context', t('個人能力要放在團隊文化與協作條件中理解。', 'Understand individual capability within team culture and collaboration.')),
      ]),
      question('reliable-delivery', t('怎麼避免交出漂亮卻不能用的 AI 作業？', 'How do I avoid polished but unusable AI work?'), t('從品質規格與查證，連到實際製作的人才要求。', 'Connect quality specifications and verification with production skills.'), [
        step(20, t('什麼才算完成，而非只是生成？', 'What counts as delivered rather than generated?'), t('SLIP 把規格、產線與檢驗放進交付流程。', 'SLIP includes specifications, production and inspection in delivery.')),
        step(6, t('我能說明內容是怎麼驗證的嗎？', 'Can I explain how the content was verified?'), t('查證經驗提醒專業信任不能只靠產量。', 'Verification experience shows why professional trust needs more than volume.'), 'complement', t('交付流程之外，補上內容可信度的檢查視角。', 'Add content credibility checks to the delivery process.')),
        step(21, t('AI 製作人實際要會什麼？', 'What does an AI producer actually need?'), t('跨工具製作與在地化案例呈現新的工作能力。', 'Cross-tool production and localization illustrate emerging skills.'), 'context', t('用製作現場對照品質要求，並看見工具也能提升工藝。', 'Compare quality requirements with production practice and AI-assisted craft.')),
      ]),
    ]),
    persona('commuter', 'everyday', t('忙碌通勤族', 'Busy commuter'), t('從每天看到的廣告、滑過的內容與購物服務切入。', 'Start with everyday ads, scrolling and shopping services.'), '↗', [
      question('daily-attention', t('每天看那麼多內容，為什麼只記得幾個？', 'Why do I remember so little of what I see?'), t('從通勤廣告的熟悉場景，理解注意力如何變成記憶。', 'Use familiar commuting scenes to explore attention and memory.'), [
        step(10, t('出現在眼前，等於真的看見嗎？', 'Does appearing on screen mean being noticed?'), t('注意力研究與捷運案例區分曝光和參與。', 'Attention research and a metro campaign distinguish exposure from engagement.')),
        step(11, t('為什麼熟悉的梗總會留下來？', 'Why do familiar references stay with us?'), t('共同記憶說明重複觀看之外的參與力量。', 'Shared memory reveals participation beyond repeated viewing.'), 'complement', t('從當下的注意力，延伸到長期留下的共同記憶。', 'Extend immediate attention to enduring shared memories.')),
        step(13, t('買過了，怎麼還是不記得品牌？', 'Why forget a brand even after buying it?'), t('購買支架的故事區分一次成交與長期偏好。', 'A shopping story distinguishes a single sale from lasting preference.'), 'tradeoff', t('對照即時轉換與長期記憶，兩者不能只用同一個數字看。', 'Compare immediate conversion with long-term memory using different lenses.')),
      ]),
      question('shopping-help', t('AI 幫我選東西，真的比較省心嗎？', 'Does AI shopping assistance really reduce effort?'), t('沿著日常選購，看懂便利背後的控制與信任。', 'Explore control and trust behind convenient everyday shopping.'), [
        step(22, t('購物 AI 到底能替我做到哪一步？', 'How far can a shopping AI act for me?'), t('零售、美妝與保健案例呈現不同授權程度。', 'Retail, beauty and wellness cases illustrate different permissions.')),
        step(18, t('它怎麼讓我知道現在在做什麼？', 'How does it show what it is doing?'), t('狀態透明與人工升級讓代理服務可被信任。', 'Visible state and escalation help make agents trustworthy.'), 'complement', t('產業案例配上信任設計，方便之外也看可控程度。', 'Pair industry cases with trust design to consider control alongside convenience.')),
        step(7, t('推薦最划算，等於我最想要嗎？', 'Is the best deal what I really want?'), t('情緒價值與偏心提醒偏好不只來自比較。', 'Emotional value and attachment show that preferences exceed comparisons.'), 'tradeoff', t('對照代理的選項比較與人原本就有的情感偏好。', 'Compare agent-led evaluation with existing human attachments.')),
      ]),
    ]),
    persona('marketer', 'marketing', t('品牌／行銷工作者', 'Brand / marketing professional'), t('面對 AI 推薦與內容量產，找回品牌被選擇的理由。', 'Build reasons to choose a brand amid AI recommendations and mass content.'), '✦', [
      question('seen-remembered', t('被 AI 引用之後，品牌還會被記住嗎？', 'Will people remember a brand cited by AI?'), t('把 AI 可見度、人心與選擇場域一起看。', 'Consider AI visibility, human connection and choice contexts together.'), [
        step(19, t('被引用和被記住，差在哪？', 'How does being cited differ from being remembered?'), t('GEO 與情境思維直接面對品牌同質化問題。', 'GEO and contextual thinking address brand sameness.')),
        step(9, t('真實討論怎麼同時服務人與 AI？', 'How can genuine discussion serve people and AI?'), t('社群內容需要兼顧可擷取資訊與共鳴。', 'Community content needs extractable information and resonance.'), 'complement', t('從品牌自有內容，擴展到別人如何談論品牌。', 'Expand from owned content to how others discuss the brand.')),
        step(13, t('哪些選擇場域值得長期投入？', 'Which choice contexts deserve investment?'), t('三層選擇場域讓媒體成效回到記憶與偏好。', 'Three choice-context layers connect media outcomes with memory and preference.'), 'context', t('將 GEO 與社群放進更完整的場域與資源配置討論。', 'Place GEO and community within a wider allocation of contexts and resources.')),
      ]),
      question('scale-distinctiveness', t('AI 內容做更多，怎麼不把品牌做平？', 'How can AI scale content without flattening the brand?'), t('先看治理，再對照工藝與真實感的不同主張。', 'Start with governance, then compare craft and authenticity.'), [
        step(20, t('哪些品質不能因量產而妥協？', 'Which qualities must survive scale?'), t('SLIP 提供從生成到交付的管理框架。', 'SLIP offers a framework from generation to delivery.')),
        step(21, t('AI 也能用來打磨質感嗎？', 'Can AI improve craft too?'), t('在地化和跨市場製作案例呈現另一種可能。', 'Localized, cross-market production illustrates another possibility.'), 'complement', t('品質治理配上工藝案例，避免把 AI 只當成提速工具。', 'Pair governance with craft examples to broaden the role of AI beyond speed.')),
        step(3, t('做得精緻，為何還不一定讓人有感？', 'Why might polished work still fail to move people?'), t('不完美與真實故事補上情感認同的判準。', 'Imperfection and real stories add emotional identification.'), 'tradeoff', t('對照可規模化製作與不可複製的真實感。', 'Compare scalable production with authenticity that resists replication.')),
      ]),
    ]),
    persona('decision-maker', 'marketing', t('團隊／企業決策者', 'Team / business decision-maker'), t('想知道先解哪個問題、如何驗證，以及誰對行動負責。', 'Decide what to solve first, how to validate it and who is accountable.'), '◎', [
      question('research-decision', t('AI 研究變快，怎麼避免更快地下錯判斷？', 'How can faster AI research avoid faster mistakes?'), t('從研究證據、人的衡斷與實驗治理建立對照。', 'Compare research evidence, human judgment and experiment governance.'), [
        step(12, t('哪些是資料，哪些只是模擬？', 'What is data, and what is simulation?'), t('People Model 分開直接證據、估計與情境模擬。', 'People Model distinguishes evidence, estimates and scenario simulations.')),
        step(14, t('最後的方向該由誰判斷？', 'Who judges the final direction?'), t('衡斷力提醒人仍要定義問題與承擔決策。', 'Judgment keeps people responsible for framing and decisions.'), 'tradeoff', t('對照模擬速度與人的責任，不把模型答案當決策授權。', 'Compare simulation speed with human responsibility without treating answers as authorization.')),
        step(17, t('怎麼知道改善沒有把風險推到後面？', 'How can improvement avoid shifting risks downstream?'), t('體驗治理同時觀察轉換與後續錯誤成本。', 'Experience governance considers conversion and downstream error costs.'), 'complement', t('研究與判斷之後，補上實際驗證和風險指標的視角。', 'Add real-world validation and risk metrics to research and judgment.')),
      ]),
      question('agent-investment', t('導入 Agent，第一筆投資該解哪個問題？', 'Which problem should the first agent investment solve?'), t('用任務、權限與文化條件一起界定投資範圍。', 'Define investment through tasks, authority and cultural conditions.'), [
        step(22, t('哪個任務值得交給 Agent？', 'Which task is worth delegating?'), t('四層權限框架把導入討論落到可做的行動。', 'Four permission levels ground adoption in concrete actions.')),
        step(16, t('團隊真的準備好新的分工了嗎？', 'Is the team ready for new roles?'), t('文化暗流揭示主管與員工期待的落差。', 'Cultural undercurrents reveal gaps between leaders and employees.'), 'context', t('技術權限之外，加入實際承接任務的組織條件。', 'Add the organizational conditions needed to use technical permissions.')),
        step(18, t('出錯時，系統如何讓人接得住？', 'How can people take over when the system fails?'), t('升級路徑、稽核與可解釋狀態讓責任具體化。', 'Escalation, audits and explainable state make accountability concrete.'), 'complement', t('將組織責任對照成產品中看得見的交接與控制。', 'Connect organizational responsibility with visible handoffs and controls in the product.')),
      ]),
    ]),
    persona('creator', 'marketing', t('內容與創意工作者', 'Content and creative professional'), t('在量產、工藝與真實感之間，找到值得保留的創作判準。', 'Find creative standards across scale, craft and authenticity.'), '✎', [
      question('creative-value', t('AI 能大量製作，創意還要守住什麼？', 'What should creativity protect when AI can produce at scale?'), t('把人性連結與製作品質放在一起，辨認效率以外的價值。', 'Compare human connection and production quality to identify value beyond efficiency.'), [
        step(3, t('真實感為什麼比完美更能打動人？', 'Why can authenticity move people more than perfection?'), t('Coinbase 與 Speak 的不完美案例，將創意連回情感認同。', 'Imperfect work from Coinbase and Speak connects creativity with emotional identification.')),
        step(21, t('AI 製作能不能兼顧工藝與文化？', 'Can AI production support craft and culture?'), t('市場 DNA 檔案與母提示詞，呈現跨市場製作如何保留在地線索。', 'Market DNA files and master prompts show how production retains local cultural cues.'), 'tradeoff', t('對照刻意保留的人性瑕疵與精細設計的生成工藝，思考各自適合的表達。', 'Compare deliberate human imperfection with carefully designed generative craft to consider where each fits.')),
        step(20, t('怎麼把創意判準變成可交付的規格？', 'How can creative standards become delivery specifications?'), t('SLIP 的規格化與三道檢驗關卡，把品牌一致性納入產製。', 'SLIP specifications and three inspection gates bring brand consistency into production.'), 'complement', t('將真實感與工藝的選擇，落實到製作前的規格與交付檢驗。', 'Turn authenticity and craft choices into production specifications and delivery checks.')),
      ]),
      question('content-resonance', t('內容怎麼同時讓 AI 讀懂、讓人想分享？', 'How can content be readable to AI and worth sharing?'), t('從社群兩難出發，對照需求情境與人的情感連結。', 'Start with social content tensions, then compare need contexts and emotional connection.'), [
        step(9, t('具體資訊與情緒故事，如何一起成立？', 'How can concrete information coexist with emotional stories?'), t('社群內容需兼顧可擷取資訊與共鳴，不能只剩產品資料庫。', 'Social content needs extractable information and resonance rather than only a product database.')),
        step(19, t('被 AI 引用後，內容如何避免變公版？', 'How can cited content avoid becoming generic?'), t('CEPs 與語境佔位把焦點從關鍵字轉向產生需求的情境。', 'CEPs and context ownership shift focus from keywords to situations that create needs.'), 'complement', t('為社群的資訊與共鳴，補上品牌能占住的具體需求情境。', 'Add concrete need contexts to the combination of useful information and resonance.')),
        step(3, t('內容留下的是資訊，還是情感印記？', 'Does the content leave information or an emotional impression?'), t('真實故事與情感架構，提供內容是否讓人願意靠近的視角。', 'Real stories and emotional architecture offer a lens on whether content invites connection.'), 'context', t('從 AI 可讀性回到創意目的，檢視內容如何建立情感認同。', 'Place AI readability within the creative goal of building emotional identification.')),
      ]),
    ]),
    persona('media-analyst', 'marketing', t('媒體與數據洞察工作者', 'Media and data insights professional'), t('辨認曝光、記憶與證據的差別，讓報表支持更好的判斷。', 'Distinguish exposure, memory and evidence so reporting supports better judgment.'), '◈', [
      question('media-measurement', t('報表數字變好，品牌真的被記住了嗎？', 'Do better metrics mean people remember the brand?'), t('從注意力品質，追到長期選擇場域與 AI 引用的不同指標。', 'Follow attention quality into long-term choice contexts and distinct AI citation metrics.'), [
        step(10, t('可視曝光能代表注意力嗎？', 'Does viewable exposure represent attention?'), t('眼動研究與 APM 區分出現在畫面上和真正被看進去。', 'Eye-tracking research and APM distinguish appearing on screen from receiving attention.')),
        step(13, t('轉換之外，該追哪種品牌資產？', 'Which brand assets matter beyond conversion?'), t('三層選擇場域區分系統可見度、社群信任與注意力記憶。', 'Three choice-context layers distinguish system visibility, community trust and attention memory.'), 'complement', t('將單次觀看的品質，放進品牌長期被選擇的診斷地圖。', 'Place the quality of a single viewing within a map of long-term brand choice.')),
        step(19, t('流量成長能說明 AI 把品牌當答案嗎？', 'Does traffic growth show that AI treats the brand as an answer?'), t('AI Citation Share of Voice、引用來源與 Time-to-Citation 提供不同於流量的觀察。', 'AI Citation Share of Voice, citation sources and Time-to-Citation offer observations beyond traffic.'), 'context', t('把媒體衡量延伸到 AI 答案場域，分清引用與人心記憶。', 'Extend measurement to AI answers while distinguishing citation from human memory.')),
      ]),
      question('insight-evidence', t('AI 洞察很快，怎麼分清證據和推測？', 'How can fast AI insights distinguish evidence from inference?'), t('對照研究來源、社群語意與指標盲點，保留判斷依據。', 'Compare research sources, community meaning and metric blind spots to retain a basis for judgment.'), [
        step(12, t('哪些結論有調查支持，哪些只是模擬？', 'Which conclusions have survey support and which are simulations?'), t('People Model 明列直接證據、模型估計與情境模擬，也交代真人研究的適用時機。', 'People Model separates direct evidence, estimates and simulations, and identifies when human research is needed.')),
        step(9, t('社群聲量多，就代表會被推薦嗎？', 'Does more discussion mean more recommendations?'), t('品類案例區分被討論與被推薦，並提醒管理語意而非只看星等。', 'Category cases distinguish discussion from recommendation and emphasize meaning rather than ratings alone.'), 'complement', t('在調查與模擬之外，補上真實討論如何被理解的觀察。', 'Add a view of how real discussion is interpreted alongside survey and simulation evidence.')),
        step(13, t('只看搜尋，漏掉了哪些選擇？', 'Which choices are missed when analysis only tracks search?'), t('眼鏡門市案例指出朋友推薦、路過與既有印象不一定留下搜尋訊號。', 'An optical retail example shows that recommendations, passing a store and existing impressions may leave no search signal.'), 'tradeoff', t('對照容易取得的數據與未被記錄的選擇脈絡，避免把觀測範圍當成全貌。', 'Compare accessible data with unrecorded choice contexts to avoid mistaking observations for the whole picture.')),
      ]),
    ]),
  ],
};

export const JOURNEY_2026: JourneyDefinition = {
  ...READING_2026,
  notice: t('這本書聚焦品牌、人與 AI。情境與選項由本站編輯設計，選擇後可核對書中觀點；推演不代表實際成效。', 'This book explores brands, people and AI. Scenarios and choices are editorial designs linked to the book, not predictions of real outcomes.'),
  personas: READING_2026.personas.map(role => ({
    ...role,
    questions: role.questions.map(concern => {
      const rounds = MISSION_ROUNDS[concern.id];
      if (!rounds || rounds.length !== concern.steps.length) throw new Error('curated mission rounds must match the reading route');
      return { ...concern, steps: concern.steps.map((entry, index) => {
        const mission = rounds[index];
        const visual = MISSION_VISUALS[mission.id];
        if (!visual) throw new Error('curated mission needs a visual scene');
        const actions = MISSION_3D_ACTIONS[mission.id];
        if (!actions) throw new Error('curated mission needs physical actions');
        const choices = Object.fromEntries(Object.entries(visual.choices).map(([id, frame]) => {
          if (!actions[id]?.length) throw new Error('curated choice needs physical actions');
          return [id, { ...frame, actions: actions[id] }];
        }));
        return { ...entry, mission: { ...mission, visual: { ...visual, choices } } };
      }) };
    }),
  })),
};

const fallback = t('這本書的角色情境尚未編排，請先從文章目錄自由閱讀。', 'Role-based missions have not been curated for this book yet. Explore its article list freely.');

export function buildReadingJourneys(edition: Edition, config?: JourneyDefinition): ReadingJourneys {
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const article of edition.articles) {
    if (!article.id || ids.has(article.id)) throw new Error('duplicate or empty article ID');
    if (!Number.isInteger(article.order) || orders.has(article.order)) throw new Error('duplicate or invalid article order');
    if (article.year !== edition.year) throw new Error('article belongs to another year');
    ids.add(article.id); orders.add(article.order);
  }
  const definition = config ?? (edition.year === JOURNEY_2026.year && edition.title === JOURNEY_2026.bookId ? JOURNEY_2026 : undefined);
  const empty: ReadingJourneys = { bookId: edition.title, year: edition.year, audiences: [], personas: [], notice: fallback };
  if (!definition) return empty;
  if (definition.bookId !== edition.title || definition.year !== edition.year) throw new Error('journey definition belongs to another book');
  const checkText = (value: I18nText) => {
    if (!value || typeof value.zh !== 'string' || !value.zh.trim() || typeof value.en !== 'string' || !value.en.trim()) throw new Error('journey text must include both languages');
  };
  const checkId = (value: string, seen: Set<string>) => {
    if (typeof value !== 'string' || !value.trim() || seen.has(value)) throw new Error('duplicate or empty journey ID');
    seen.add(value);
  };
  checkText(definition.notice);
  const audienceIds = new Set<string>();
  for (const audience of definition.audiences) {
    checkId(audience.id, audienceIds);
    if (!['marketing', 'everyday'].includes(audience.id)) throw new Error('invalid journey audience ID');
    checkText(audience.title); checkText(audience.description);
    if (!audience.icon) throw new Error('journey audience needs an icon');
  }
  const personaIds = new Set<string>();
  const questionIds = new Set<string>();
  const missionIds = new Set<string>();
  const personas: ReadingJourneys['personas'][number][] = [];
  for (const role of definition.personas) {
    if (!audienceIds.has(role.audienceId)) throw new Error('unknown journey audience reference');
    checkId(role.id, personaIds); checkText(role.title); checkText(role.description);
    if (!role.icon) throw new Error('journey persona needs an icon');
    const questions: ReadingJourneys['personas'][number]['questions'][number][] = [];
    for (const concern of role.questions) {
      checkId(concern.id, questionIds); checkText(concern.title); checkText(concern.why);
      if (concern.steps.length !== 3) throw new Error('a reading journey needs three distinct articles');
      const used = new Set<string>();
      let missing = false;
      const steps = concern.steps.flatMap((entry, index) => {
        checkText(entry.prompt); checkText(entry.reason);
        if ((index === 0 && entry.connection) || (index > 0 && !entry.connection)) throw new Error('connections belong to the second and third steps');
        if (entry.connection) {
          if (!['complement', 'tradeoff', 'context'].includes(entry.connection.kind)) throw new Error('invalid journey connection');
          checkText(entry.connection.explanation);
        }
        if (entry.mission) {
          const mission = entry.mission;
          checkId(mission.id, missionIds);
          checkText(mission.scene); checkText(mission.goal); checkText(mission.takeaway);
          if (!Array.isArray(mission.choices) || mission.choices.length < 2 || mission.choices.length > 3) throw new Error('a mission needs two or three choices');
          const choiceIds = new Set<string>();
          for (const choice of mission.choices) {
            checkId(choice.id, choiceIds);
            checkText(choice.label); checkText(choice.outcome); checkText(choice.tradeoff);
          }
          if (mission.visual) validateMissionVisual(mission.visual, mission.choices.map(choice => choice.id));
        }
        if ((entry.articleId === undefined) === (entry.articleOrder === undefined)) throw new Error('provide exactly one article reference');
        if (entry.articleOrder !== undefined && !Number.isInteger(entry.articleOrder)) throw new Error('invalid journey article order');
        const article = edition.articles.find(a => entry.articleId !== undefined ? a.id === entry.articleId : a.order === entry.articleOrder);
        if (!article) {
          if (config) throw new Error('unknown journey article reference');
          missing = true;
          return [];
        }
        if (used.has(article.id)) throw new Error('a reading journey needs three distinct articles');
        used.add(article.id);
        return [{ articleId: article.id, prompt: entry.prompt, reason: entry.reason, ...(entry.connection ? { connection: entry.connection } : {}), ...(entry.mission ? { mission: entry.mission } : {}) }];
      });
      if (!missing) questions.push({ id: concern.id, title: concern.title, why: concern.why, steps });
    }
    if (questions.length) personas.push({ id: role.id, audienceId: role.audienceId, title: role.title, description: role.description, icon: role.icon, questions });
  }
  const audiences = definition.audiences.filter(audience => personas.some(role => role.audienceId === audience.id));
  return { ...empty, audiences, personas, notice: personas.length ? definition.notice : fallback };
}

export function resolveJourney(data: ReadingJourneys, personaId: string, questionId: string) {
  return data.personas.find(role => role.id === personaId)?.questions.find(question => question.id === questionId);
}
