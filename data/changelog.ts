export type ChangeCategory =
  | "feature"
  | "fix"
  | "improvement"
  | "breaking"
  | "removed"
  | "refactor";

export interface ChangeEntry {
  category: ChangeCategory;
  description: string;
  details?: string;
  tags?: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string;
  title?: string;
  summary?: string;
  changes: ChangeEntry[];
}

export const CATEGORY_META: Record<
  ChangeCategory,
  { label: string; iconName: string; className: string }
> = {
  feature: {
    label: "Tính năng mới",
    iconName: "Sparkles",
    className:
      "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  fix: {
    label: "Sửa lỗi",
    iconName: "Bug",
    className:
      "bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  },
  improvement: {
    label: "Cải thiện",
    iconName: "Wrench",
    className:
      "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  },
  breaking: {
    label: "Thay đổi lớn",
    iconName: "AlertTriangle",
    className:
      "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  },
  removed: {
    label: "Đã loại bỏ",
    iconName: "Trash2",
    className:
      "bg-gray-500/15 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400",
  },
  refactor: {
    label: "Tái cấu trúc",
    iconName: "RefreshCw",
    className:
      "bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400",
  },
};

export const changelog: ChangelogRelease[] = [
  {
    version: "0.8.1",
    date: "2026-03-30",
    title: "Phân tích thông minh & Giao diện di động",
    summary:
      "Tối ưu phân tích AI với retry thông minh, bật/tắt từng bước, và cải thiện toàn diện giao diện trên điện thoại.",
    changes: [
      {
        category: "improvement",
        description: "Phân tích AI: retry thông minh và bật/tắt từng bước",
        details:
          "Khi phân tích gặp lỗi, chỉ chạy lại phần thất bại thay vì toàn bộ. Bật/tắt từng bước (phân tích chương, tổng hợp, hồ sơ nhân vật) trước khi chạy. Có thể sửa mô hình và prompt ngay khi gặp lỗi rồi thử lại.",
        tags: ["phân tích", "AI"],
      },
      {
        category: "improvement",
        description: "Giao diện di động tối ưu toàn diện",
        details:
          "Tối ưu bố cục, kích thước nút, và trải nghiệm tương tác cho người dùng trên điện thoại.",
        tags: ["giao diện", "di động"],
      },
      {
        category: "fix",
        description: "Sửa tràn nội dung khi mở bảng chat",
        details:
          "Danh sách chương và trang chủ không còn bị tràn sang phải khi mở bảng trò chuyện AI hoặc trên màn hình nhỏ.",
        tags: ["giao diện", "sửa lỗi"],
      },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-03-30",
    title: "Scraper — Nhập truyện từ website",
    summary:
      "Nhập truyện từ các trang web bên ngoài trực tiếp vào thư viện, không cần copy-paste thủ công.",
    changes: [
      {
        category: "feature",
        description: "Scraper truyện từ website",
        details:
          "Dán URL trang truyện, chọn chương muốn lấy, hệ thống tự động tải và nhập vào thư viện. Theo dõi tiến trình realtime với cảnh báo nếu chương nào tải lỗi.",
        tags: ["scraper"],
      },
      {
        category: "feature",
        description: "Extension duyệt web đi kèm",
        details:
          "Cài tiện ích mở rộng Chrome nhẹ để vượt qua giới hạn trình duyệt khi tải nội dung. Tải trực tiếp từ trang Scraper, hướng dẫn cài đặt tích hợp sẵn.",
        tags: ["scraper", "extension"],
      },
      {
        category: "feature",
        description: "Hỗ trợ lấy nội dung từ Sáng Tác Việt",
        details:
          "Cho phép tự động lấy nội dung chương từ Sáng Tác Việt. Lưu ý cần kiểm tra trang gốc hoạt động tốt trên trình duyệt của bạn trước khi chạy.",
        tags: ["scraper"],
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-03-30",
    title: "Trợ lý AI thông minh & Tìm kiếm toàn cục",
    summary:
      "Chat AI hiểu ngữ cảnh tiểu thuyết, tra cứu bằng công cụ thông minh. Tìm kiếm toàn cục (⌘K) fuzzy xuyên suốt ứng dụng.",
    changes: [
      {
        category: "feature",
        description: "Chat AI tự nhận biết ngữ cảnh tiểu thuyết",
        details:
          "Khi mở chat trên trang tiểu thuyết hoặc chương, AI tự động đính kèm ngữ cảnh. Cuộc trò chuyện mới tự gắn tiểu thuyết đang xem. Có thể gỡ hoặc đính kèm thủ công tiểu thuyết khác.",
        tags: ["chat", "AI", "ngữ cảnh"],
      },
      {
        category: "feature",
        description: "7 công cụ tra cứu cho AI",
        details:
          "AI tự quyết định khi nào cần tra cứu thêm thông tin: tổng quan tiểu thuyết, thế giới quan, chi tiết chương, nội dung chương, nhân vật, ghi chú, và tìm kiếm toàn văn. Tùy chỉnh giới hạn bước công cụ trong cài đặt chat.",
        tags: ["chat", "AI", "công cụ"],
      },
      {
        category: "feature",
        description: "Tìm kiếm toàn cục (⌘K)",
        details:
          "Nhấn ⌘K (hoặc Ctrl+K) để mở hộp tìm kiếm. Tìm fuzzy xuyên suốt: trang, tiểu thuyết, chương, nhân vật, ghi chú, nội dung chương.",
        tags: ["tìm kiếm", "điều hướng"],
      },
      {
        category: "improvement",
        description: "Giao diện trang tiểu thuyết làm mới",
        details:
          "Cải thiện giao diện tab Chương, Thế giới quan, Nhân vật trong trang Tiểu thuyết",
        tags: ["giao diện", "tiểu thuyết"],
      },
      {
        category: "improvement",
        description: "Tự động mở cuộc trò chuyện gần nhất",
        details:
          "Khi mở bảng chat mà chưa chọn cuộc trò chuyện nào, tự động chọn cuộc trò chuyện gần nhất thay vì hiển thị màn hình trống.",
        tags: ["chat", "trải nghiệm"],
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-03-29",
    title: "AI miễn phí trên trình duyệt với WebGPU",
    summary:
      "Chạy AI trực tiếp trên GPU của bạn qua WebGPU — không cần API key, không gửi dữ liệu ra ngoài. Hỗ trợ Qwen3, Llama 3.2 và DeepSeek R1 với quản lý model tích hợp.",
    changes: [
      {
        category: "feature",
        description: "Nhà cung cấp Chat AI WebGPU miễn phí",
        details:
          "Chạy model AI trực tiếp trên trình duyệt qua WebGPU mà không cần API key hay kết nối internet sau khi tải model. WebGPU luôn sẵn sàng như nhà cung cấp hệ thống — chọn trong cài đặt chat để bắt đầu. Phù hợp cho trò chuyện ngắn, model nhỏ chạy nhanh trên hầu hết máy tính có GPU.",
        tags: ["AI", "WebGPU", "miễn phí"],
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-03-28",
    title: "Tìm & Thay thế nâng cao",
    summary:
      "Công cụ tìm kiếm và thay thế văn bản với regex, từ điển quy tắc, thay thế hàng loạt. Diff nội tuyến mới với đánh dấu vị trí trên thanh cuộn.",
    changes: [
      {
        category: "feature",
        description: "Tìm & Thay thế với từ điển quy tắc",
        details:
          "Tìm kiếm realtime với highlight, thay thế bằng chuỗi hoặc regex. Lưu mẫu thành quy tắc riêng cho tiểu thuyết hoặc toàn cục — hỗ trợ bật/tắt, sắp xếp, phân biệt hoa/thường. Chạy trên chương hiện tại hoặc thay thế hàng loạt nhiều chương với xem trước và bật/tắt từng rule.",
        tags: ["thay thế", "soạn thảo"],
      },
      {
        category: "feature",
        description: "Diff nội tuyến & đánh dấu thanh cuộn",
        details:
          "Chế độ xem diff nội tuyến mới hiển thị thêm/xóa/sửa trên cùng một bảng với ký hiệu +/−/~. Chuyển đổi giữa song song và nội tuyến khi thay thế hàng loạt. Các vị trí thay đổi được đánh dấu trên thanh cuộn trong cả trình soạn thảo, diff nội tuyến và diff song song.",
        tags: ["diff", "giao diện"],
      },
      {
        category: "refactor",
        description: "Tách quy tắc thay thế và loại trừ ra khỏi từ điển tên",
        details:
          "Quy tắc thay thế và danh sách tên loại trừ lưu trong bảng riêng. Giao diện từ điển vẫn giữ 3 tab. Dữ liệu cũ tự động chuyển đổi.",
        tags: ["cơ sở dữ liệu", "tái cấu trúc"],
      },
      {
        category: "improvement",
        description: "Bảng chat và từ điển không còn tranh chấp với công cụ",
        details:
          "Chat và từ điển hiển thị dạng panel cố định khi không dùng công cụ, hoặc overlay nổi khi công cụ đang mở — không còn tự đóng khi mở bảng khác. Đóng chat không làm mất cuộc trò chuyện đang chạy.",
        tags: ["giao diện", "trải nghiệm"],
      },
    ],
  },
  {
    version: "0.4.3",
    date: "2026-03-28",
    title: "Nhận diện tên tự động & Mở rộng từ điển",
    summary:
      "Engine convert tự nhận diện tên nhân vật/địa danh dựa trên họ và tần suất xuất hiện. Loại trừ tên sai để revert bản dịch. Bổ sung hơn 400 tên nổi tiếng mới.",
    changes: [
      {
        category: "feature",
        description: "Tự nhận diện tên riêng khi convert",
        details:
          "Engine tự phát hiện tên nhân vật và địa danh chưa có trong từ điển dựa trên cấu trúc họ-tên và tần suất xuất hiện. Tên được nhận diện sẽ tự động viết hoa trong kết quả. Có thể thêm vào từ điển hoặc loại trừ nếu nhận diện sai — kết quả convert sẽ tự cập nhật. Danh sách loại trừ được lưu vĩnh viễn và hiển thị trong tab riêng của từ điển tên.",
        tags: ["convert", "tên riêng"],
      },
      {
        category: "improvement",
        description: "Bổ sung hơn 400 tên mới",
        details:
          "Từ điển tên mặc định thêm nhân vật Tam Quốc, Kim Dung, Tây Du Ký, Hồng Lâu Mộng, Thủy Hử, nhân vật lịch sử, thần thoại, và địa danh phổ biến.",
        tags: ["convert", "từ điển"],
      },
    ],
  },
  {
    version: "0.4.2",
    date: "2026-03-27",
    title: "Trình soạn thảo & So sánh văn bản",
    summary:
      "Trình soạn thảo mới với đánh số dòng, bộ so sánh song song với word-level diff, và sửa lỗi convert tách rời chữ Latin/Việt.",
    changes: [
      {
        category: "feature",
        description: "Trình soạn thảo văn bản với đánh số dòng",
        details:
          "Editor mới hiển thị số dòng bên trái giống. Đã tích hợp vào trang soạn thảo chương và trang convert.",
        tags: ["soạn thảo", "tính năng"],
      },
      {
        category: "feature",
        description: "Bộ so sánh văn bản song song",
        details:
          "So sánh hai văn bản song song với word-level diff highlight, đồng bộ cuộn, cài đặt cỡ chữ, và bật/tắt diff. Cài đặt được lưu theo từng ngữ cảnh sử dụng.",
        tags: ["soạn thảo", "tính năng"],
      },
      {
        category: "fix",
        description: "Sửa lỗi convert tách rời chữ Latin và tiếng Việt",
        details:
          "Văn bản Latin trong đoạn Trung không còn bị tách từng ký tự. Giữ nguyên khoảng cách giữa các từ đã dịch.",
        tags: ["convert", "sửa lỗi"],
      },
    ],
  },
  {
    version: "0.4.1",
    date: "2026-03-27",
    title: "Nâng cao chất lượng convert & Live mode",
    summary:
      "Kết quả convert chính xác hơn với viết hoa thông minh, xử lý dấu câu chuẩn, và chế độ Live tự động dịch khi gõ.",
    changes: [
      {
        category: "feature",
        description: "Chế độ Live — convert tự động khi gõ",
        details:
          "Bật công tắc Live trên trang Convert nhanh để kết quả dịch tự động cập nhật liên tục.",
        tags: ["convert", "trải nghiệm"],
      },
      {
        category: "improvement",
        description: "Cải thiện viết hoa tự động và tùy chọn viết hoa chủ động",
        details:
          "Cải thiện xử lý tự động viết hoa trong câu. Thêm tùy chọn viết hoa tự động trong ngoặc sách.",
        tags: ["convert", "chất lượng"],
      },
      {
        category: "improvement",
        description: "Xử lý các dấu câu và cải thiện các từ thường gặp",
        details:
          "Các dấu câu toàn chiều như giờ tự động chuyển thành dấu câu thông thường. Các từ hay gặp giờ được dịch đúng nghĩa phổ biến nhất thay vì chọn nghĩa hiếm từ từ điển.",
        tags: ["convert", "chất lượng"],
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-03-27",
    title: "Quick Translator — Convert truyện Trung-Việt",
    summary:
      "Chuyển đổi tiểu thuyết tiếng Trung sang tiếng Việt bằng từ điển QT, không cần AI hay API key. Tùy chỉnh cách convert và quản lý từ điển tên nhân vật.",
    changes: [
      {
        category: "feature",
        description: "Convert truyện Trung → Việt bằng từ điển QT",
        details:
          "Dán văn bản tiếng Trung vào trang Convert nhanh hoặc dùng nút Convert ngay trong trình soạn thảo chương. Kết quả tự động viết hoa tên riêng, chọn nghĩa phù hợp, và giữ đúng định dạng đoạn văn.",
        tags: ["convert", "dịch thuật"],
      },
      {
        category: "feature",
        description: "Tùy chỉnh cách convert",
        details:
          "Điều chỉnh thứ tự ưu tiên giữa từ điển tên và từ vựng, độ dài cụm từ, cách áp dụng luật nhân xưng, và nhiều tùy chọn khác. Cài đặt được lưu lại và dùng chung cho cả trang Convert nhanh lẫn soạn thảo chương.",
        tags: ["convert", "cài đặt"],
      },
      {
        category: "feature",
        description: "Quản lý từ điển và từ điển tên",
        details:
          "Xem, tải xuống, hoặc thay thế từng bộ từ điển QT. Nhập danh sách tên nhân vật từ file .txt với tùy chọn giữ bản cũ hoặc ghi đè khi trùng. Tra cứu và lọc từ điển tên theo loại (nhân vật, địa danh, môn phái...) ngay từ thanh bên.",
        tags: ["từ điển", "quản lý"],
      },
    ],
  },
  {
    version: "0.3.4",
    date: "2026-03-26",
    title: "Cải thiện xử lý lỗi AI & Trải nghiệm chat",
    summary:
      "Hiển thị lỗi AI chi tiết và rõ ràng hơn, hỗ trợ tải trace log để debug, và nút sao chép nội dung tin nhắn.",
    changes: [
      {
        category: "feature",
        description:
          "Nút sao chép nội dung tin nhắn, tải trace log khi AI gặp lỗi",
        details:
          "Di chuột vào bất kỳ tin nhắn nào trong chat để hiện nút sao chép nội dung dạng văn bản thuần. Khi AI trả về lỗi, bạn có thể tải xuống file JSON chứa toàn bộ thông tin debug",
        tags: ["chat", "tiện ích", "debug"],
      },
      {
        category: "improvement",
        description: "Hiển thị lỗi AI chi tiết theo mã trạng thái",
        details:
          "Phân biệt rõ các loại lỗi, dễ dàng nhận biết và sửa lỗi. Tin nhắn lỗi hiển thị với giao diện khác biệt.",
        tags: ["chat", "trải nghiệm"],
      },
    ],
  },
  {
    version: "0.3.3",
    date: "2026-03-26",
    title: "Lịch sử phiên bản & Soạn thảo nâng cao",
    summary:
      "Lưu nhiều phiên bản nội dung chương, hoàn tác/làm lại, cảnh báo thay đổi chưa lưu.",
    changes: [
      {
        category: "feature",
        description: "Lịch sử phiên bản nội dung",
        details:
          "Lưu tối đa 10 phiên bản mỗi cảnh. So sánh, khôi phục phiên bản cũ từ thanh công cụ. Dịch hàng loạt tự động tạo phiên bản.",
        tags: ["phiên bản"],
      },
      {
        category: "feature",
        description: "Hoàn tác / Làm lại (Ctrl+Z / Ctrl+Shift+Z)",
        details:
          "Hoàn tác mọi thay đổi trong phiên soạn thảo, kể cả kết quả AI dịch/sửa.",
        tags: ["soạn thảo", "phím tắt"],
      },
      {
        category: "feature",
        description: "Cảnh báo rời trang khi chưa lưu",
        tags: ["soạn thảo"],
      },
      {
        category: "improvement",
        description: "Nút hành động AI cố định ở cuối bảng công cụ",
        tags: ["giao diện"],
      },
      {
        category: "breaking",
        description: "Cần xóa dữ liệu cũ và nhập lại từ bản sao lưu",
        tags: ["cơ sở dữ liệu"],
      },
    ],
  },
  {
    version: "0.3.2",
    date: "2026-03-26",
    title: "Nhật ký thay đổi & Cải thiện phân tích",
    summary:
      "Thêm trang nhật ký thay đổi để theo dõi lịch sử phát triển ứng dụng. Sửa lỗi phân tích AI không trả về dữ liệu xây dựng thế giới.",
    changes: [
      {
        category: "feature",
        description: "Trang nhật ký thay đổi",
        details:
          "Xem lịch sử cập nhật của Novel Studio theo dòng thời gian. Mỗi phiên bản hiển thị tóm tắt, danh sách thay đổi theo loại (tính năng, sửa lỗi, cải thiện...) và các tag liên quan. Có thể lọc theo loại thay đổi.",
        tags: ["trang mới", "lịch sử"],
      },
      {
        category: "fix",
        description: "Phân tích AI giờ trả về đầy đủ dữ liệu xây dựng thế giới",
        details:
          "Trước đây, sau khi phân tích xong, các mục thế giới quan, phe phái, và địa điểm có thể bị trống do dữ liệu AI trả về không được lưu đúng cách. Đã sửa để đảm bảo mọi trường luôn được ghi vào cơ sở dữ liệu.",
        tags: ["phân tích", "xây dựng thế giới"],
      },
      {
        category: "improvement",
        description: "Phân tích gia tăng thông minh hơn",
        details:
          "Khi chạy phân tích cập nhật (không phải toàn bộ), AI giờ sẽ tự động điền các trường đang trống thay vì chỉ cập nhật trường đã thay đổi. Tăng giới hạn số lượng thao tác AI có thể thực hiện trong một lần phân tích.",
        tags: ["phân tích", "AI"],
      },
    ],
  },
  {
    version: "0.3.1",
    date: "2026-03-26",
    title: "Dịch thuật hàng loạt",
    summary:
      "Chọn nhiều chương và dịch tất cả chỉ với một thao tác. Kiểm soát tốt hơn quá trình dịch thuật với khả năng ngắt an toàn và tuỳ chỉnh chất lượng.",
    changes: [
      {
        category: "feature",
        description: "Dịch nhiều chương cùng lúc",
        details:
          "Chọn các chương cần dịch từ danh sách, bấm dịch một lần — hệ thống sẽ lần lượt dịch từng chương và tự động lưu kết quả. Bạn có thể theo dõi tiến trình trực tiếp trên màn hình.",
        tags: ["dịch thuật", "năng suất"],
      },
      {
        category: "feature",
        description: "Hỏi xác nhận trước khi dừng giữa chừng",
        details:
          "Khi bạn muốn dừng một tiến trình AI đang chạy (dịch thuật, phân tích...), ứng dụng sẽ hỏi xác nhận thay vì dừng ngay lập tức — tránh mất dữ liệu do bấm nhầm.",
        tags: ["trải nghiệm", "an toàn"],
      },
      {
        category: "improvement",
        description: "Tuỳ chỉnh chất lượng dịch thuật",
        details:
          "Điều chỉnh mức độ ngữ cảnh mà AI sẽ đọc khi dịch — mức cao cho bản dịch chính xác hơn, mức thấp cho tốc độ nhanh hơn. Có thể bật/tắt dịch tiêu đề chương.",
        tags: ["dịch thuật", "tuỳ chỉnh"],
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-03-25",
    title: "Công cụ viết & Quản lý dữ liệu",
    summary:
      "AI giờ có thể giúp bạn viết lại, mở rộng, tóm tắt nội dung ngay trong trình soạn thảo. Sao lưu và khôi phục toàn bộ dữ liệu với mã hoá bảo vệ.",
    changes: [
      {
        category: "feature",
        description: "AI hỗ trợ chỉnh sửa ngay trong trình soạn thảo",
        details:
          "Chọn một đoạn văn và yêu cầu AI viết lại, mở rộng chi tiết, tóm tắt ngắn gọn, dịch sang ngôn ngữ khác, hoặc đánh giá chất lượng — tất cả ngay bên cạnh trình soạn thảo mà không cần chuyển trang.",
        tags: ["soạn thảo", "AI"],
      },
      {
        category: "feature",
        description: "Sao lưu và khôi phục dữ liệu",
        details:
          "Xuất toàn bộ tiểu thuyết, chương, nhân vật và ghi chú ra một file duy nhất. Nhập lại bất cứ lúc nào trên thiết bị khác. Có thể đặt mật khẩu để bảo vệ file sao lưu.",
        tags: ["dữ liệu", "bảo mật"],
      },
      {
        category: "feature",
        description: "Trang chủ với thống kê tổng quan",
        details:
          "Xem nhanh tổng số tiểu thuyết, chương, nhân vật, ghi chú trong thư viện. Danh sách chương bạn vừa chỉnh sửa gần đây để tiếp tục ngay.",
        tags: ["trang chủ"],
      },
      {
        category: "improvement",
        description: "Phân tích AI ổn định và chi tiết hơn",
        details:
          "Khi AI gặp lỗi giữa chừng, hệ thống tự động thử lại thay vì dừng hoàn toàn. Hiển thị rõ ràng đã phân tích bao nhiêu chương, tìm thấy bao nhiêu nhân vật và mối quan hệ.",
        tags: ["phân tích", "ổn định"],
      },
      {
        category: "feature",
        description: "Kéo thả để thay đổi kích thước bảng công cụ",
        details:
          "Kéo cạnh viền để mở rộng hoặc thu nhỏ thanh công cụ AI bên cạnh trình soạn thảo, phù hợp với kích thước màn hình của bạn. Giao diện chat cũng hoạt động tốt trên điện thoại.",
        tags: ["giao diện", "di động"],
      },
      {
        category: "feature",
        description: "Thư viện tiểu thuyết với tìm kiếm và lọc",
        details:
          "Tìm tiểu thuyết theo tên, sắp xếp theo ngày tạo hoặc tên, lọc theo thể loại. Chuyển đổi giữa chế độ xem lưới và danh sách. Thêm nhiều chương cùng lúc bằng cách dán nội dung và tách tự động theo quy tắc.",
        tags: ["thư viện", "tổ chức"],
      },
      {
        category: "improvement",
        description: "Đơn giản hoá cách lưu trữ kết quả phân tích",
        details:
          "Kết quả phân tích (thể loại, tóm tắt, thế giới quan, phe phái, địa điểm) giờ được lưu trực tiếp cùng tiểu thuyết thay vì tách riêng — giúp dữ liệu nhất quán và dễ quản lý hơn.",
        tags: ["cải tiến nội bộ"],
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-03-24",
    title: "Nền tảng cốt lõi",
    summary:
      "Kết nối với nhiều dịch vụ AI khác nhau, trò chuyện với AI trong ngữ cảnh tiểu thuyết, và phân tích tự động toàn bộ tác phẩm.",
    changes: [
      {
        category: "feature",
        description: "Kết nối với nhiều dịch vụ AI",
        details:
          "Sử dụng OpenAI, Anthropic, Google, Groq, Mistral, xAI, hoặc bất kỳ dịch vụ nào tương thích. Cấu hình đường dẫn và khoá API cho từng nhà cung cấp trong trang cài đặt.",
        tags: ["AI", "cấu hình"],
      },
      {
        category: "feature",
        description: "Trợ lý AI cạnh bên",
        details:
          "Nhấn vào biểu tượng AI trên thanh trên để mở sidebar trò chuyện, giúp hỏi đáp các vấn đề mở rộng không có giới hạn.",
        tags: ["chat", "sáng tác"],
      },
      {
        category: "feature",
        description: "Phân tích tiểu thuyết tự động bằng AI",
        details:
          "AI đọc từng chương, tổng hợp cốt truyện, xác định nhân vật và mối quan hệ giữa họ. Khi bạn thêm chương mới, chỉ cần phân tích phần mới — không cần chạy lại toàn bộ.",
        tags: ["phân tích", "nhân vật"],
      },
      {
        category: "feature",
        description: "Giao diện hoàn toàn bằng tiếng Việt",
        details:
          "Mọi nút bấm, thông báo, và hướng dẫn đều hiển thị bằng tiếng Việt. Phông chữ được chọn riêng để hiển thị tiếng Việt rõ ràng và đẹp mắt.",
        tags: ["tiếng Việt"],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-03-23",
    title: "Khởi đầu",
    summary:
      "Phiên bản đầu tiên của Novel Studio — không gian sáng tác dành riêng cho người viết tiểu thuyết, hoạt động hoàn toàn trên trình duyệt mà không cần máy chủ.",
    changes: [
      {
        category: "feature",
        description: "Ra mắt Novel Studio",
        details:
          "Ứng dụng viết tiểu thuyết chạy trực tiếp trên trình duyệt. Mọi dữ liệu được lưu ngay trên máy của bạn — không gửi lên đâu cả, không cần đăng nhập.",
        tags: ["ra mắt", "local-first"],
      },
    ],
  },
];
