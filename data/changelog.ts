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
    version: "0.4.0",
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
    date: "2026-03-25",
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
        description: "Trò chuyện với AI về tiểu thuyết của bạn",
        details:
          "Mở bảng chat bên phải màn hình để hỏi AI về cốt truyện, nhân vật, hoặc xin gợi ý sáng tác. AI hiểu ngữ cảnh tiểu thuyết bạn đang làm việc.",
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
          "Ứng dụng viết tiểu thuyết chạy trực tiếp trên trình duyệt. Mọi dữ liệu được lưu ngay trên máy của bạn — không gửi lên đâu cả, không cần đăng nhập, không cần internet (trừ khi dùng AI).",
        tags: ["ra mắt", "local-first"],
      },
    ],
  },
];
