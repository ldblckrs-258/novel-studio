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
    version: "0.8.0",
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
    version: "0.7.0",
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
    version: "0.6.0",
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
    version: "0.5.0",
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
