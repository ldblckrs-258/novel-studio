import type { ConvertSource } from "./qt-engine.types";

export const NAME_SOURCES = new Set<ConvertSource>([
  "qt-name",
  "novel-name",
  "global-name",
  "auto-name",
]);

export const SENTENCE_ENDERS = /[.!?。！？…\n：:；;]/;
export const CAP_TRIGGERS = /[《«]/;
export const CAP_PASSTHROUGH =
  /^[\s\u3000""''「『（(\[{<》」』）\])}>《》«»，、；：,.:;!?。！？…～·\-–—\u201c\u201d\u2018\u2019]+$/;

export const NO_SPACE_BEFORE =
  /[,.:;!?。，、；：！？…\u201d\u2019」』）\])}>》»～·\-–—\u2014%°\s]/;
export const NO_SPACE_AFTER = /[\u201c\u2018「『（\[({<《«\-–—\u2014\s]/;
export const DIGIT_TRAILING = /\d$/;
export const DIGIT_LEADING = /^\d/;
/** Matches a trailing word character (letter or digit) — used to keep
 *  passthrough (source:"unknown") tokens like "ABC123" together. */
export const WORD_CHAR_TRAILING = /[\d\p{Script=Latin}]$/u;
export const WORD_CHAR_LEADING = /^[\d\p{Script=Latin}]/u;

export const BRACKET_OPEN = /[《«]/;
export const BRACKET_CLOSE = /[》»]/;

// ─── Dialogue quote boundaries ──────────────────────────────

export const DIALOGUE_OPEN = new Set(["\u201C", "\u300C", "\u300E"]); // " 「 『
export const DIALOGUE_CLOSE = new Set(["\u201D", "\u300D", "\u300F"]); // " 」 』

// ─── Full-width → ASCII punctuation ─────────────────────────

export const FULLWIDTH_PUNCT: Record<string, string> = {
  "，": ",",
  "。": ".",
  "：": ":",
  "；": ";",
  "！": "!",
  "？": "?",
  "（": "(",
  "）": ")",
  "【": "[",
  "】": "]",
  "、": ",",
  "～": "~",
  "「": "\u201C",
  "」": "\u201D",
  "『": "\u2018",
  "』": "\u2019",
  "\u3000": " ",
  "…": "...",
  "……": "...",
  "—": "\u2014",
  "──": "\u2014",
};

const FULLWIDTH_RE = new RegExp(
  Object.keys(FULLWIDTH_PUNCT)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "g",
);

export function normalizeFullwidthPunct(text: string): string {
  return text.replace(FULLWIDTH_RE, (m) => FULLWIDTH_PUNCT[m] ?? m);
}


/** Chinese suffixes that capitalize when following a name (geographic, titles, orgs) */
export const NAME_SUFFIXES = new Set(
  "省市县区镇村山河湖海岛峰谷关城宫殿阁楼塔寺庙庄府院堂门派宗帝王皇后妃侯公伯子爵将帅族氏家國国".split(
    "",
  ),
);

// ─── Name detection data ─────────────────────────────────────

/** Characters that are definitively NOT given-name components.
 *  If ANY char in the given-name portion belongs to this set → skip. */
export const NON_NAME_CHARS = new Set([
  // Particles & modal words
  "的", "了", "着", "过", "吗", "呢", "吧", "啊", "哦", "嗯",
  "啦", "嘛", "呀", "哩", "喽",
  // Pronouns
  "我", "你", "他", "她", "它", "们",
  // Prepositions & conjunctions
  "在", "从", "到", "对", "把", "被", "给", "让", "跟", "和",
  "与", "或", "但", "而", "且", "若", "虽",
  // Common auxiliary/structural
  "是", "有", "没", "不", "也", "都", "就", "还", "又", "才",
  "很", "太", "更", "最", "已", "正", "将", "要", "会", "能",
  // Directional complements
  "上", "下", "里", "去", "来",
]);

// ─── Surname data for auto name detection ────────────────────

/** Single-character Chinese surnames (~370) */
export const SINGLE_SURNAMES = new Set([
  "王", "李", "张", "刘", "陈", "杨", "黄", "赵", "吴", "周",
  "徐", "孙", "马", "胡", "朱", "郭", "何", "林", "罗", "高",
  "梁", "郑", "谢", "宋", "唐", "许", "韩", "冯", "邓", "曹",
  "彭", "曾", "肖", "田", "董", "潘", "袁", "蔡", "蒋", "余",
  "于", "杜", "叶", "程", "魏", "苏", "吕", "丁", "任", "卢",
  "姚", "沈", "钟", "姜", "崔", "谭", "陆", "范", "汪", "廖",
  "石", "金", "韦", "贾", "夏", "付", "方", "邹", "熊", "白",
  "孟", "秦", "邱", "侯", "江", "尹", "薛", "闫", "段", "雷",
  "龙", "黎", "史", "贺", "陶", "顾", "毛", "郝", "龚", "邵",
  "万", "覃", "武", "钱", "戴", "严", "莫", "孔", "向", "常",
  "汤", "赖", "文", "施", "洪", "季", "辛", "康", "聂", "章",
  "鲁", "翁", "殷", "庄", "柳", "甘", "祝", "包", "宁", "尚",
  "纪", "舒", "阮", "柯", "庞", "凌", "骆", "蓝", "霍", "项",
  "麦", "温", "车", "古", "华", "成", "苗", "瞿", "商", "童",
  "屈", "卫", "牛", "寇", "樊", "左", "岳", "申", "巫", "仲",
  "连", "裴", "盛", "佟", "路", "游", "靳", "欧", "管", "柴",
  "苑", "耿", "关", "兰", "焦", "巩", "单", "齐", "翟", "牟",
  "封", "曲", "鞠", "储", "桂", "司", "解", "卓", "褚", "堵",
  "乐", "简", "伍", "窦", "居", "楚", "冀", "宫", "祁", "全",
  "鄢", "缪", "艾", "隋", "米", "池", "明", "满", "别", "蒲",
  "劳", "仇", "花", "荆", "安", "寿", "戚", "阎", "宗", "穆",
  "容", "卜", "苟", "郁", "惠", "甄", "奚", "麻", "权", "符",
  "谷", "裘", "那", "英", "凤", "虞", "慕", "景", "詹", "木",
  "边", "计", "沙", "伏", "和", "鱼", "国", "岑", "松", "井",
  "佘", "浦", "步", "言", "蓬", "郦", "刁", "都", "匡", "习",
  "扈", "费", "阳", "冷", "强", "茹", "干", "蒙", "弓", "诸",
  "葛", "贲", "原", "闻", "南", "倪", "柏", "晏", "丰", "喻",
  "植", "应", "阚", "班", "房", "雍", "从", "桑", "索", "宣",
  "谈", "郎", "经", "仉", "鲍", "臧", "籍", "双", "邢", "皮",
  "咸", "逄", "禹", "公", "燕", "巴", "颜", "乌", "冉", "蔺",
]);

/** Compound (2-char) Chinese surnames */
export const COMPOUND_SURNAMES = new Set([
  "欧阳", "司马", "上官", "诸葛", "司徒", "东方", "独孤", "南宫",
  "万俟", "闻人", "夏侯", "慕容", "皇甫", "令狐", "轩辕", "尉迟",
  "长孙", "宇文", "公孙", "端木", "百里", "东郭", "南门", "西门",
]);

/** Check if a character is a CJK ideograph */
export function isCJK(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
    (code >= 0x3400 && code <= 0x4dbf) // CJK Extension A
  );
}


