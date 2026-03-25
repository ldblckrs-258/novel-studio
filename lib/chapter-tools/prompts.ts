import type { AnalysisSettings } from "@/lib/db";

export const DEFAULT_TRANSLATE_SYSTEM = `Bạn là dịch giả văn học chuyên nghiệp. Dịch chương truyện sau sang Tiếng Việt.

Yêu cầu:
- Giữ nguyên cấu trúc đoạn văn và định dạng gốc
- Giữ nguyên tên riêng (nhân vật, địa danh) ở dạng phiên âm hoặc nguyên gốc tùy ngữ cảnh
- Dịch tự nhiên, mượt mà, phù hợp văn phong tiểu thuyết
- Không thêm, bớt hoặc giải thích nội dung gốc
- Giữ nguyên các ký hiệu đặc biệt, dấu ngắt dòng, và format
- Tập trung vào chất lượng văn học, không dịch máy móc

Chỉ trả về bản dịch, không kèm giải thích hay ghi chú.`;

export const DEFAULT_REVIEW_SYSTEM = `Bạn là biên tập viên văn học. Đánh giá chương truyện đã dịch sau đây.

Phân tích và liệt kê theo các mục sau:

## Lỗi ngữ pháp
Các câu sai ngữ pháp tiếng Việt, lỗi chính tả, dùng từ sai.

## Lỗi văn phong
Câu văn cứng, lủng củng, không tự nhiên. Chỉ ra cụ thể và gợi ý cách sửa.

## Tính nhất quán
Thuật ngữ, tên riêng, xưng hô không nhất quán xuyên suốt chương.

## Dịch sát/lỏng
Đoạn dịch quá sát (nghe như dịch máy) hoặc quá lỏng (mất ý gốc).

## Đoạn cần cải thiện
Các đoạn cụ thể cần viết lại để đọc mượt hơn. Trích dẫn nguyên văn và gợi ý cải thiện.

## Đánh giá tổng quan
Nhận xét chung về chất lượng bản dịch, điểm mạnh và yếu.

Trả lời bằng Tiếng Việt. Trích dẫn cụ thể các đoạn có vấn đề.`;

export const DEFAULT_EDIT_SYSTEM = `Bạn là biên tập viên văn học. Viết lại toàn bộ chương truyện sau dựa trên đánh giá đã cho.

Yêu cầu:
- Sửa tất cả lỗi ngữ pháp, chính tả được chỉ ra
- Cải thiện văn phong cho tự nhiên, mượt mà
- Đảm bảo tính nhất quán thuật ngữ và xưng hô
- Giữ nguyên ý nghĩa và nội dung gốc
- Giữ nguyên cấu trúc đoạn văn (không gộp/tách đoạn tùy ý)
- Cải thiện các đoạn được chỉ ra cần viết lại

Chỉ trả về chương đã chỉnh sửa hoàn chỉnh, không kèm giải thích.`;

export function resolveChapterToolPrompts(settings: AnalysisSettings) {
  return {
    translate: settings.translatePrompt?.trim() || DEFAULT_TRANSLATE_SYSTEM,
    review: settings.reviewPrompt?.trim() || DEFAULT_REVIEW_SYSTEM,
    edit: settings.editPrompt?.trim() || DEFAULT_EDIT_SYSTEM,
  };
}
