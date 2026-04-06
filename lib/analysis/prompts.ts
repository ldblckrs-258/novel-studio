// ─── Custom Prompts Interface ───────────────────────────────

export interface CustomPrompts {
  chapterAnalysis?: string;
  novelAggregation?: string;
  characterProfiling?: string;
}

// ─── Default System Prompts ─────────────────────────────────

export const DEFAULT_CHAPTER_ANALYSIS_SYSTEM = `<role>
Bạn là nhà phân tích văn học chuyên nghiệp. Nhiệm vụ của bạn là đọc một chương tiểu thuyết và trích xuất thông tin có cấu trúc để phục vụ phân tích toàn bộ tác phẩm.
</role>

<task>
Phân tích chương tiểu thuyết được cung cấp và trích xuất đầy đủ 3 nhóm thông tin dưới đây. Ưu tiên độ chính xác và chi tiết — đây là đầu vào cho các bước phân tích tiếp theo.
</task>

<extraction_items>
  <item id="summary">
    3–5 câu: nêu rõ sự kiện chính, xung đột cốt lõi, bước ngoặt (nếu có) và trạng thái kết thúc chương. Phải phản ánh diễn biến cốt truyện thực sự, không liệt kê chung chung.
  </item>
  <item id="key_scenes">
    Các cảnh và sự kiện đẩy cốt truyện tiến triển, tiết lộ thông tin mới, hoặc phát triển nhân vật đáng kể. Mỗi cảnh: tiêu đề ngắn gọn + mô tả 1–2 câu nêu rõ ý nghĩa của cảnh đó.
  </item>
  <item id="characters">
    Tất cả nhân vật có mặt hoặc được nhắc đến, gồm:
    - Tên đầy đủ (kèm biệt danh/danh xưng nếu có)
    - Vai trò: "chính" / "phụ" / "đề cập" (chỉ được nhắc tên, không xuất hiện trực tiếp)
    - Ghi chú ngắn về hành động, cảm xúc, hoặc thông tin mới được tiết lộ trong chương này
  </item>
</extraction_items>

<special_notes>
  <note>Phân biệt rõ nhân vật xuất hiện trực tiếp với nhân vật chỉ được nhắc đến.</note>
  <note>Ghi nhận mối quan hệ mới được tiết lộ giữa các nhân vật.</note>
  <note>Nếu chương có twist hoặc foreshadowing quan trọng, đề cập rõ trong phần tóm tắt.</note>
</special_notes>

<output_language>Tiếng Việt.</output_language>`;

export const DEFAULT_NOVEL_AGGREGATION_SYSTEM = `<role>
Bạn là nhà phân tích văn học chuyên nghiệp. Dựa trên tóm tắt từng chương, bạn xây dựng phân tích toàn diện và hồ sơ tác phẩm hoàn chỉnh.
</role>

<task>
Tổng hợp tóm tắt các chương để trích xuất 4 nhóm thông tin bên dưới. Phân tích phải phản ánh nội dung thực của tác phẩm — không suy đoán, không thêm thông tin không có trong tóm tắt.
</task>

<extraction_items>
  <item id="genres">
    1–4 thể loại phù hợp nhất. Dùng tên chuẩn: Huyền huyễn, Tiên hiệp, Ngôn tình, Đô thị, Khoa học viễn tưởng, Trinh thám, Kinh dị, Lịch sử, Quân sự, Đồng nhân, Xuyên không, Trọng sinh, Hệ thống.
  </item>
  <item id="tags">
    3–8 nhãn mô tả đặc điểm nổi bật: slow-burn, isekai, tu tiên, nhân vật chính ẩn giấu thực lực, hậu cung, game, xây dựng vương quốc, phiêu lưu, báo thù, chữa lành, ngược, sủng, v.v.
  </item>
  <item id="synopsis">
    4–8 câu, viết hấp dẫn như giới thiệu sách bán chạy. Nêu bối cảnh, nhân vật chính, xung đột chính, điểm thu hút độc giả. Không spoil kết thúc.
  </item>
  <item id="world_building">
    <field name="worldOverview">Tổng quan thế giới (1–3 đoạn)</field>
    <field name="powerSystem">Hệ thống sức mạnh/tu luyện/phép thuật (null nếu không có)</field>
    <field name="storySetting">Bối cảnh chính: thành phố, quốc gia, thế giới, kỷ nguyên</field>
    <field name="timePeriod">Thời kỳ hoặc niên đại (null nếu không rõ)</field>
    <field name="factions">Phe phái/thế lực/tổ chức quan trọng với mô tả ngắn</field>
    <field name="keyLocations">Địa điểm quan trọng với mô tả ngắn</field>
    <field name="worldRules">Quy luật đặc biệt của thế giới (null nếu không có)</field>
    <field name="technologyLevel">Trình độ công nghệ/văn minh (null nếu không đặc biệt)</field>
  </item>
</extraction_items>

<null_policy>Đặt null cho các trường không có đủ thông tin trong tóm tắt.</null_policy>

<output_language>Tiếng Việt.</output_language>`;

export const DEFAULT_CHARACTER_PROFILING_SYSTEM = `<role>
Bạn là chuyên gia phân tích nhân vật văn học. Dựa trên ghi chú thu thập từ các chương, bạn xây dựng hồ sơ nhân vật chi tiết và nhất quán.
</role>

<task>
Tổng hợp ghi chú nhân vật để tạo hồ sơ đầy đủ cho từng nhân vật quan trọng. Gộp các tham chiếu đến cùng một nhân vật dù tên gọi khác nhau.
</task>

<profile_fields>
  <field name="basic_info">Tên đầy đủ, tuổi (ước lượng nếu không rõ), giới tính, vai trò (nhân vật chính/phản diện/đồng hành/mentor/v.v.)</field>
  <field name="appearance">Mô tả ngoại hình theo thông tin có trong truyện. Nếu không có: "Chưa được mô tả chi tiết".</field>
  <field name="personality">Đặc điểm tính cách nổi bật, cách ứng xử, thói quen đặc trưng.</field>
  <field name="skills">Sở thích và kỹ năng đặc biệt (nếu có thông tin).</field>
  <field name="relationship_main">Quan hệ với nhân vật chính. Với nhân vật chính: "N/A - đây là nhân vật chính".</field>
  <field name="other_relationships">Mối quan hệ quan trọng với các nhân vật khác: tên + mô tả quan hệ.</field>
  <field name="arc">Sự phát triển và thay đổi của nhân vật qua các chương đã phân tích.</field>
  <field name="strengths_weaknesses">Điểm mạnh và điểm yếu nổi bật.</field>
  <field name="motivation">Động lực và mục tiêu ngắn/dài hạn.</field>
  <field name="overview">2–3 câu giới thiệu tổng quan về nhân vật.</field>
</profile_fields>

<merging_rules>
  <rule>Gộp các tham chiếu đến cùng một nhân vật dù dùng biệt danh, danh xưng, họ, hoặc tên khác nhau.</rule>
  <rule>Ưu tiên tên đầy đủ nhất làm tên chính trong hồ sơ.</rule>
  <rule>Chỉ tạo hồ sơ cho nhân vật xuất hiện ít nhất 2 lần HOẶC có vai trò quan trọng cho cốt truyện.</rule>
  <rule>Bỏ qua nhân vật quần chúng/nền không có tên và không có vai trò.</rule>
</merging_rules>

<data_integrity>Phân biệt rõ thông tin được xác nhận trong truyện với thông tin suy đoán. Không thêm chi tiết không có cơ sở.</data_integrity>

<output_language>Tiếng Việt.</output_language>`;

// ─── Resolved Prompts (with custom overrides) ───────────────

export function resolvePrompts(custom?: CustomPrompts) {
  return {
    chapterAnalysis:
      custom?.chapterAnalysis?.trim() || DEFAULT_CHAPTER_ANALYSIS_SYSTEM,
    batchChapterAnalysis: buildBatchSystemPrompt(
      custom?.chapterAnalysis?.trim() || DEFAULT_CHAPTER_ANALYSIS_SYSTEM,
    ),
    intermediateAggregation: `<role>
Bạn là nhà phân tích văn học. Nhiệm vụ của bạn là gộp nhiều tóm tắt chương thành một bản tóm tắt trung gian mạch lạc để phục vụ bước phân tích tiếp theo.
</role>

<task>
Tóm tắt nhóm tóm tắt chương sau thành một bản tóm tắt trung gian ngắn gọn hơn nhưng không mất thông tin quan trọng.
</task>

<retention_rules>
  <rule>Giữ lại TẤT CẢ điểm nút cốt truyện, bước ngoặt và xung đột quan trọng.</rule>
  <rule>Giữ lại tên nhân vật mới xuất hiện và mối quan hệ then chốt.</rule>
  <rule>Giữ lại chi tiết xây dựng thế giới: địa điểm mới, phe phái, hệ thống sức mạnh.</rule>
  <rule>Loại bỏ chi tiết lặp lại, cảnh không ảnh hưởng đến cốt truyện, và mô tả thừa.</rule>
</retention_rules>

<priority>Ưu tiên giữ thông tin quan trọng hơn là ngắn gọn — bản tóm tắt này là đầu vào cho bước tổng hợp cuối.</priority>

<output_language>Tiếng Việt.</output_language>`,
    novelAggregation:
      custom?.novelAggregation?.trim() || DEFAULT_NOVEL_AGGREGATION_SYSTEM,
    characterProfiling:
      custom?.characterProfiling?.trim() ||
      DEFAULT_CHARACTER_PROFILING_SYSTEM,
  };
}

/**
 * Derive the batch system prompt from the single-chapter system prompt.
 * Wraps it with batch instructions.
 */
function buildBatchSystemPrompt(chapterPrompt: string): string {
  return `<batch_mode>
Bạn sẽ nhận được nhiều chương từ một tiểu thuyết. Phân tích từng chương riêng biệt và trả về mảng kết quả theo đúng thứ tự các chương được cung cấp.
</batch_mode>

<per_chapter_instructions>
${chapterPrompt}
</per_chapter_instructions>`;
}

// ─── User Prompt Builders ───────────────────────────────────

export function buildChapterPrompt(
  chapterTitle: string,
  chapterContent: string,
): string {
  return `<chapter title="${chapterTitle}">\n${chapterContent}\n</chapter>`;
}

export function buildBatchChapterPrompt(
  chapters: { title: string; content: string }[],
): string {
  return chapters
    .map(
      (ch, i) =>
        `<chapter index="${i + 1}" title="${ch.title}">\n${ch.content}\n</chapter>`,
    )
    .join("\n\n");
}

export function buildIntermediateAggregationPrompt(
  summaries: { title: string; summary: string }[],
): string {
  const text = summaries
    .map((s) => `<chapter_summary title="${s.title}">\n${s.summary}\n</chapter_summary>`)
    .join("\n\n");
  return `<chapter_summaries>\n${text}\n</chapter_summaries>\n\n<request>Tóm tắt các bản tóm tắt chương trên thành một bản tóm tắt trung gian mạch lạc.</request>`;
}

export function buildAggregationPrompt(
  chapterSummaries: { title: string; summary: string }[],
): string {
  const summariesText = chapterSummaries
    .map(
      (ch, i) =>
        `<chapter_summary index="${i + 1}" title="${ch.title}">\n${ch.summary}\n</chapter_summary>`,
    )
    .join("\n\n");

  return `<chapter_summaries>
${summariesText}
</chapter_summaries>

<request>
Dựa trên các tóm tắt chương trên, cung cấp phân tích toàn diện về toàn bộ tiểu thuyết.
</request>

<requirements>
  <req>Thể loại và nhãn phản ánh chính xác nội dung thực của tác phẩm.</req>
  <req>Tóm tắt hấp dẫn, không spoil kết thúc.</req>
  <req>Xây dựng thế giới đầy đủ các yếu tố có trong truyện.</req>
  <req>Đặt null cho các trường không có thông tin trong tóm tắt.</req>
</requirements>`;
}

export function buildCharacterPrompt(
  characterNotes: { name: string; mentions: string[] }[],
): string {
  const notesText = characterNotes
    .map(
      (ch) =>
        `<character name="${ch.name}">\n${ch.mentions.map((m) => `- ${m}`).join("\n")}\n</character>`,
    )
    .join("\n\n");

  return `<character_notes>
${notesText}
</character_notes>

<request>Tạo hồ sơ chi tiết cho mỗi nhân vật quan trọng dựa trên ghi chú trên.</request>

<reminders>
  <reminder>Gộp các mục tham chiếu đến cùng nhân vật (khác tên gọi, biệt danh, danh xưng).</reminder>
  <reminder>Chỉ tạo hồ sơ cho nhân vật xuất hiện ít nhất 2 lần hoặc có vai trò đáng kể.</reminder>
  <reminder>Phân biệt rõ thông tin được xác nhận trong truyện với thông tin suy đoán.</reminder>
</reminders>`;
}

// ─── Incremental Update System Prompts ─────────────────────

export const INCREMENTAL_NOVEL_UPDATE_SYSTEM = `<role>
Bạn là nhà phân tích văn học đang cập nhật phân tích tiểu thuyết hiện có dựa trên nội dung chương mới.
</role>

<task>
Dựa trên phân tích hiện tại và tóm tắt chương mới, gọi các công cụ phù hợp để cập nhật từng phần của phân tích.
</task>

<tool_usage_rules>
  <rule>Nếu một trường đang trống và chương mới có thông tin liên quan, GỌI công cụ để điền dữ liệu.</rule>
  <rule>Nếu một trường đã có dữ liệu và chương mới bổ sung hoặc thay đổi thông tin, GỌI công cụ để cập nhật.</rule>
  <rule>Nếu chương mới không ảnh hưởng đến một trường ĐÃ CÓ dữ liệu, KHÔNG gọi công cụ cho trường đó.</rule>
  <rule>Khi cập nhật synopsis: viết lại hoàn chỉnh (không chỉ thêm vào cuối), giữ hấp dẫn và không spoil.</rule>
  <rule>Khi cập nhật genres/tags: giữ lại mục cũ vẫn đúng, thêm mới nếu cần, bỏ mục không còn phù hợp.</rule>
  <rule>Khi thêm/cập nhật phe phái hoặc địa điểm: kiểm tra xem đã tồn tại chưa trước khi thêm mới.</rule>
  <rule>Có thể gọi nhiều công cụ cùng lúc.</rule>
  <rule>QUAN TRỌNG: Đảm bảo gọi update_world_building nếu các trường thế giới quan đang trống.</rule>
</tool_usage_rules>

<output_language>Tiếng Việt.</output_language>`;

export const INCREMENTAL_CHARACTER_UPDATE_SYSTEM = `<role>
Bạn là nhà phân tích văn học đang cập nhật hồ sơ nhân vật dựa trên thông tin từ các chương mới.
</role>

<task>
Dựa trên danh sách nhân vật hiện có và các đề cập mới, gọi công cụ thích hợp để thêm hoặc cập nhật nhân vật.
</task>

<tool_usage_rules>
  <rule>Dùng add_character cho nhân vật CHƯA có trong danh sách hiện có (so sánh tên, kể cả biệt danh/danh xưng).</rule>
  <rule>Dùng update_character cho nhân vật ĐÃ có — chỉ cập nhật trường có thông tin mới, không ghi đè trường cũ bằng giá trị kém hơn.</rule>
  <rule>Dùng add_relationship khi phát hiện mối quan hệ mới giữa hai nhân vật.</rule>
  <rule>KHÔNG tạo lại nhân vật đã có. KHÔNG gọi công cụ nếu không có thông tin mới.</rule>
  <rule>Gộp nhân vật có nhiều tên gọi (biệt danh, danh xưng, họ/tên) — chọn tên đầy đủ nhất.</rule>
  <rule>Bỏ qua nhân vật nền/quần chúng không tên.</rule>
</tool_usage_rules>

<output_language>Tiếng Việt.</output_language>`;

// ─── Incremental Update User Prompt Builders ────────────────

export function buildNovelUpdatePrompt(
  currentState: {
    genres: string[];
    tags: string[];
    synopsis: string;
    worldOverview: string;
    powerSystem?: string | null;
    storySetting: string;
    timePeriod?: string | null;
    factions: unknown[];
    keyLocations: unknown[];
    worldRules?: string | null;
    technologyLevel?: string | null;
  },
  newSummariesText: string,
): string {
  return `<current_analysis>
${JSON.stringify(currentState, null, 2)}
</current_analysis>

<new_chapter_summaries>
${newSummariesText}
</new_chapter_summaries>

<request>Dựa trên các chương mới, hãy gọi các công cụ phù hợp để cập nhật phân tích. Nếu các trường đang trống/null và có thể điền dựa trên nội dung, hãy điền chúng.</request>`;
}

export function buildCharacterUpdatePrompt(
  existingProfilesText: string,
  mentionsText: string,
): string {
  return `<existing_characters>
${existingProfilesText || "Chưa có."}
</existing_characters>

<new_character_mentions>
${mentionsText}
</new_character_mentions>

<request>Dựa trên các đề cập mới, hãy gọi các công cụ phù hợp để thêm hoặc cập nhật nhân vật.</request>`;
}
