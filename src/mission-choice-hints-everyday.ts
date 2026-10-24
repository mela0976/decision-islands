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

export const EVERYDAY_MISSION_HINTS: Readonly<
  Record<string, Readonly<Record<'a' | 'b', readonly MissionChangeHint[]>>>
> = {
  'shared-memory-1': {
    a: [e(['elder', 'adult', 'child', 'playlist'], '歌單手機分兩側，家人尚未共聽', 'The playlist and phone start apart.', '播放熟悉歌單，家人靠近共聽', 'They listen to a familiar playlist.')],
    b: [e(['elder', 'adult', 'child', 'playlist', 'phone'], '歌單手機分兩側，家人尚未共聽', 'The playlist and phone start apart.', '長輩孩子各帶近期作品，輪流聽', 'They trade recent song picks.')],
  },
  'shared-memory-2': {
    a: [e(['elder', 'adult', 'fan', 'playlist', 'poster'], '粉絲拿著海報，長輩帶著熟悉歌單', 'Fan holds poster; elder has songs.', '成人接歌單上螢幕，粉絲介紹應援', 'Adult cues; fan explains poster.')],
    b: [e(['elder', 'adult', 'fan', 'poster'], '粉絲拿著海報，長輩帶著熟悉歌單', 'Fan holds poster; elder has songs.', '粉絲帶頭玩應援，家人聚來參與', 'Fan waves poster; family cheers.')],
  },
  'shared-memory-3': {
    a: [e(['adult', 'phone', 'heart'], '桌上有紀念品，手機顯示商品頁', 'Keepsake, product page; no choice.', '成人先核對價格條件，紀念品留桌', 'Adult checks price, terms on phone.')],
    b: [e(['elder', 'adult', 'child', 'book', 'heart'], '桌上有紀念品，手機顯示商品頁', 'Keepsake, product page; no choice.', '長輩分享紀念品代表的時刻', 'Elder shares the keepsake story.')],
  },
  'family-trust-1': {
    a: [e(['adult', 'child', 'phone', 'document', 'magnifier'], '手機顯示活動影片，來源待查', 'Video source on phone is unclear.', '成人向分享者詢問影片原始來源', 'Adult asks where video came from.')],
    b: [e(['adult', 'child', 'phone', 'poster', 'document', 'magnifier'], '手機顯示活動影片，來源待查', 'Phone event video; source unknown.', '成人以海報和文件比對影片來源', 'Adult checks video against poster.')],
  },
  'family-trust-2': {
    a: [e(['child', 'adult', 'poster'], '活動海報在桌上，家人尚未談偏好', 'Poster sits by family calendar.', '孩子先說想參加哪場，成人聆聽', 'Child slides poster; adult listens.')],
    b: [e(['child', 'adult', 'elder', 'calendar'], '活動海報在桌上，家人尚未談偏好', 'Poster sits by family calendar.', '成人與長輩先核對行事曆', 'Adults check dates on calendar.')],
  },
  'family-trust-3': {
    a: [e(['adult', 'elder', 'robot', 'phone', 'document'], '手機有邀請，助理尚未擬回覆', 'Invite open; no reply draft yet.', '助理交出時段草稿，成人自行準備回覆', 'Assistant hands adult a reply draft.')],
    b: [e(['adult', 'elder', 'robot', 'phone', 'calendar', 'document'], '手機有邀請，助理尚未擬回覆', 'Invite open; no reply draft yet.', '先看邀請預覽，成人核對時間對象', 'Adult checks invite details first.')],
  },
  'experience-value-1': {
    a: [e(['speaker', 'newcomer', 'microphone'], '工作坊備有麥克風與方法書', 'Workshop has a mic and method book.', '講者用麥克風分享臨場判斷經驗', 'Speaker shares a career choice.')],
    b: [e(['speaker', 'newcomer', 'book'], '工作坊備有麥克風與方法書', 'Workshop has a mic and method book.', '講者把方法清單交給新手共讀', 'Speaker hands methods to newcomer.')],
  },
  'experience-value-2': {
    a: [e(['organizer', 'speaker', 'robot', 'document', 'screen'], '團隊有訪談文件，AI尚未整理草案', 'Interview notes await an AI summary.', '主辦人從AI摘要整理核心問題', 'AI notes shape organizer’s question.')],
    b: [e(['organizer', 'speaker', 'robot', 'document', 'screen', 'lightbulb'], '團隊有訪談文件，AI尚未整理草案', 'Interview notes await an AI summary.', 'AI列出活動草案，團隊逐份比較', 'AI drafts options; team reviews.')],
  },
  'experience-value-3': {
    a: [e(['speaker', 'microphone', 'document'], '講者面對鏡頭，腳本已放好', 'Speaker has a script before camera.', '保留講者停頓與不確定口述', 'Speaker pauses; crew keeps it.')],
    b: [e(['speaker', 'microphone', 'document'], '講者面對鏡頭，腳本已放好', 'Speaker has a script before camera.', '講者照腳本說出個人轉職細節', 'Speaker reads script details.')],
  },
  'connection-control-1': {
    a: [e(['elder', 'adult', 'newcomer', 'book'], '回憶冊與手機分在桌子兩端', 'Memory book and phones start apart.', '熟同學分享回憶冊，新成員靠近聽', 'Group gathers around memory book.')],
    b: [e(['elder', 'adult', 'newcomer', 'phone'], '回憶冊與手機分在桌子兩端', 'Memory book and phones start apart.', '每位成員分享近期生活片段', 'Members share recent phone moments.')],
  },
  'connection-control-2': {
    a: [e(['member', 'organizer', 'robot', 'calendar', 'poster'], '行事曆與場地海報已放桌上', 'Calendar and venue posters are out.', '助理整理空檔與場地，成員一起看', 'Assistant sorts times and venues.')],
    b: [e(['member', 'organizer', 'robot', 'calendar', 'poster', 'phone'], '行事曆與場地海報已放桌上', 'Calendar and venue posters are out.', '助理先出訂場邀請預覽，成員核對', 'Members preview the booking invite.')],
  },
  'connection-control-3': {
    a: [e(['member', 'robot', 'document'], '簡餐與紀念品待選，購物車尚空', 'Snacks and keepsakes await choice.', '助理列出選項，成員拿清單挑選', 'Assistant lists snacks, keepsakes.')],
    b: [e(['member', 'organizer', 'robot', 'document', 'book', 'cart'], '簡餐與紀念品待選，購物車尚空', 'Snacks and keepsakes await choice.', '先訂品項與支出界線，再交助理採買', 'Members set budget; assistant buys.')],
  },
  'human-skill-1': {
    a: [e(['researcher', 'user', 'microphone'], '桌上有AI摘要，線索尚未釐清', 'AI summary sits unchecked.', '研究員訪談使用者，補進情境用語', 'Researcher interviews user.')],
    b: [e(['researcher', 'robot', 'document', 'screen', 'microphone'], '桌上有AI摘要，線索尚未釐清', 'AI summary sits unchecked.', '研究員圈出摘要矛盾，供主管查看', 'Researcher flags AI note conflicts.')],
  },
  'human-skill-2': {
    a: [e(['manager', 'researcher', 'consumer', 'poster'], '產品資料與旅程圖在桌上', 'Notes and journey map sit out.', '研究員問使用者產品何時派上用場', 'Researcher asks when product helps.')],
    b: [e(['manager', 'researcher', 'consumer', 'chart'], '產品資料與旅程圖在桌上', 'Notes and journey map sit out.', '團隊查看旅程中卡住的步驟', 'Team reviews where users get stuck.')],
  },
  'human-skill-3': {
    a: [e(['designer', 'client', 'manager', 'check'], '提案已備妥，修改回饋尚未整合', 'Proposals lack a feedback owner.', '設計與客戶提出卡點，主管聆聽', 'Designers and clients name blockers.')],
    b: [e(['designer', 'client', 'manager'], '提案已備妥，修改回饋尚未整合', 'Proposals lack a feedback owner.', '主管擔任窗口，收攏修改回饋', 'Manager is the revision contact.')],
  },
  'reliable-delivery-1': {
    a: [e(['marketer', 'document', 'lightbulb'], '新品簡報旁，品牌規格文件空白', 'Product brief; blank brand guide.', '行銷人員寫下語氣主張與禁用項', 'Marketer writes brand rules for use.')],
    b: [e(['manager', 'marketer', 'robot', 'document', 'screen', 'shield', 'lightbulb'], '新品簡報旁，品牌規格文件空白', 'Product brief; blank brand guide.', '先做一版樣稿，團隊校準品牌期待', 'Manager and marketer review samples.')],
  },
  'reliable-delivery-2': {
    a: [e(['creator', 'document', 'book'], '初稿主張缺少核准資料直接支持', 'A draft claim lacks direct support.', '創作者逐句比對核准資料', 'Creator matches claims to approvals.')],
    b: [e(['creator', 'owner', 'document', 'magnifier'], '初稿主張缺少核准資料直接支持', 'A draft claim lacks direct support.', '產品負責人標出有據主張與待修改句', 'Owner marks proven claims and edits.')],
  },
  'reliable-delivery-3': {
    a: [e(['creative', 'editor', 'document'], '全球主視覺固定，文件列著在地用語', 'Fixed global art beside local copy.', '保留主視覺，編輯改寫台灣文案', 'Editor adapts local copy for art.')],
    b: [e(['creative', 'editor', 'screen', 'poster', 'document'], '全球主視覺固定，文件列著在地用語', 'Fixed global art beside local copy.', '先整理在地線索，再生成場景版本', 'Team drafts scenes from local cues.')],
  },
  'daily-attention-1': {
    a: [e(['commuter', 'phone', 'bag'], '通勤者常經廣告，尚未存下活動', 'A station ad sits beside a phone.', '先把活動存進手機，再提包前往月台', 'Commuter saves event, then boards.')],
    b: [e(['commuter', 'phone', 'calendar', 'bag'], '通勤者常經廣告，尚未存下活動', 'A station ad sits beside a phone.', '等車時打開廣告互動查看細節', 'Commuter checks ad details on phone.')],
  },
  'daily-attention-2': {
    a: [e(['commuter', 'friend', 'playlist'], '兩人相約碰面，手機與歌單分兩側', 'They meet; playlist and phone apart.', '播放彼此熟悉的歌，兩人一起聽', 'They listen to a familiar playlist.')],
    b: [e(['commuter', 'friend', 'phone', 'playlist'], '兩人相約碰面，手機與歌單分兩側', 'They meet; playlist and phone apart.', '輪流分享新歌，各說喜歡的片段', 'They take turns sharing new songs.')],
  },
  'daily-attention-3': {
    a: [e(['commuter', 'mug', 'phone', 'poster', 'calendar'], '貨架有飲品，手機旁有活動線索', 'Drink and station ad sit by phone.', '通勤者核對飲品標示與價格', 'Commuter checks drink price, label.')],
    b: [e(['commuter', 'mug', 'phone', 'poster', 'calendar'], '貨架有飲品，手機旁有活動線索', 'Drink and station ad sit by phone.', '回想朋友推薦與活動，再核對飲品條件', 'They recall tip, check drink facts.')],
  },
  'shopping-help-1': {
    a: [e(['adult', 'robot', 'document'], '成人請助理找早餐選項，購物車空著', 'Adult asks; cart starts empty.', '助理列出品項與備餐方式供成人查看', 'Assistant lists breakfast options.')],
    b: [e(['adult', 'robot', 'phone', 'cart', 'mug'], '成人請助理找早餐選項，購物車空著', 'Adult asks; cart starts empty.', '助理把合適品項先放入購物車', 'Assistant adds chosen items to cart.')],
  },
  'shopping-help-2': {
    a: [e(['adult', 'robot', 'document'], '購物建議待核，停止鍵在桌邊', 'Shopping draft; stop control nearby.', '助理逐項說明，成人核對偏好', 'Assistant explains; adult reviews.')],
    b: [e(['adult', 'robot', 'cart', 'shield', 'stop-control'], '購物建議待核，停止鍵在桌邊', 'Shopping draft; stop control nearby.', '助理放入常用品，停止控制留在手邊', 'Regular items in cart; stop is near.')],
  },
  'shopping-help-3': {
    a: [e(['adult', 'child', 'mug', 'other-mug', 'phone', 'heart'], '兩款飲品條件接近，手機顯示價格', 'Drinks differ in cost, familiarity.', '成人比對價格條件，兩款飲品並列', 'Adult checks price, terms on phone.')],
    b: [e(['adult', 'child', 'mug', 'other-mug', 'phone', 'heart'], '兩款飲品條件接近，手機顯示價格', 'Drinks differ in cost, familiarity.', '孩子移來熟悉飲品，成人核對今日需求', 'Child offers familiar drink.')],
  },
};
