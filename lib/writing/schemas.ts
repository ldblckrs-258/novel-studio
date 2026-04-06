import { jsonSchema } from "ai";
import type {
  ContextAgentOutput,
  DirectionAgentOutput,
  OutlineAgentOutput,
  ReviewAgentOutput,
  RewriteAgentOutput,
} from "./types";

export const contextOutputSchema = jsonSchema<ContextAgentOutput>({
  type: "object",
  properties: {
    previousEvents: {
      type: "string",
      description: "Tóm tắt các sự kiện đã xảy ra trong các chương trước",
    },
    characterStates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Tên nhân vật" },
          currentState: {
            type: "string",
            description: "Trạng thái hiện tại (vị trí, tâm trạng, quan hệ)",
          },
        },
        required: ["name", "currentState"],
        additionalProperties: false,
      },
      description: "Trạng thái hiện tại của các nhân vật quan trọng",
    },
    worldState: {
      type: "string",
      description:
        "Trạng thái thế giới: thế lực, xung đột, sự kiện đang diễn ra",
    },
    plotProgress: {
      type: "string",
      description: "Tiến trình mạch truyện chính và phụ",
    },
    unresolvedThreads: {
      type: "array",
      items: { type: "string" },
      description: "Các tuyến truyện, foreshadowing chưa giải quyết",
    },
  },
  required: [
    "previousEvents",
    "characterStates",
    "worldState",
    "plotProgress",
    "unresolvedThreads",
  ],
  additionalProperties: false,
});

export const directionOutputSchema = jsonSchema<DirectionAgentOutput>({
  type: "object",
  properties: {
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID duy nhất cho hướng đi" },
          title: {
            type: "string",
            description: "Tiêu đề ngắn gọn (3-5 từ)",
          },
          description: {
            type: "string",
            description: "Mô tả chi tiết hướng phát triển (2-3 câu)",
          },
          plotImpact: {
            type: "string",
            description: "Tác động đến mạch truyện chính",
          },
          characters: {
            type: "array",
            items: { type: "string" },
            description: "Nhân vật đóng vai trò quan trọng",
          },
          type: {
            type: "string",
            enum: [
              "action",
              "character-development",
              "plot-twist",
              "world-building",
              "resolution",
            ],
            description: "Loại hướng đi",
          },
        },
        required: [
          "id",
          "title",
          "description",
          "plotImpact",
          "characters",
          "type",
        ],
        additionalProperties: false,
      },
      description: "3-5 hướng đi đề xuất cho chương tiếp theo",
    },
    recommendedOptionIds: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 3,
      description:
        "1-3 id từ options mà bạn đánh giá là phù hợp nhất (phải trùng id trong options)",
    },
  },
  required: ["options", "recommendedOptionIds"],
  additionalProperties: false,
});

export const outlineOutputSchema = jsonSchema<OutlineAgentOutput>({
  type: "object",
  properties: {
    chapterTitle: {
      type: "string",
      description: "Tiêu đề chương",
    },
    synopsis: {
      type: "string",
      description: "Tóm tắt nội dung chương (2-3 câu)",
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Tiêu đề phân cảnh" },
          summary: {
            type: "string",
            description: "Tóm tắt nội dung (3-5 câu)",
          },
          characters: {
            type: "array",
            items: { type: "string" },
            description: "Nhân vật xuất hiện",
          },
          location: { type: "string", description: "Địa điểm" },
          keyEvents: {
            type: "array",
            items: { type: "string" },
            description: "Sự kiện chính trong cảnh",
          },
          mood: { type: "string", description: "Tâm trạng/không khí" },
          wordCountTarget: {
            type: "number",
            description: "Số từ mục tiêu cho phân cảnh",
          },
        },
        required: [
          "title",
          "summary",
          "characters",
          "keyEvents",
          "mood",
          "wordCountTarget",
        ],
        additionalProperties: false,
      },
    },
    totalWordCountTarget: {
      type: "number",
      description: "Tổng số từ mục tiêu cho chương",
    },
  },
  required: ["chapterTitle", "synopsis", "scenes", "totalWordCountTarget"],
  additionalProperties: false,
});

export const reviewOutputSchema = jsonSchema<ReviewAgentOutput>({
  type: "object",
  properties: {
    overallScore: {
      type: "number",
      description: "Điểm tổng thể 0-10",
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["character", "plot", "tone", "world-rules"],
            description: "Loại vấn đề",
          },
          severity: {
            type: "string",
            enum: ["critical", "minor", "suggestion"],
            description: "Mức độ nghiêm trọng",
          },
          description: { type: "string", description: "Mô tả vấn đề" },
          location: {
            type: "string",
            description: "Vị trí trong chương",
          },
          suggestion: { type: "string", description: "Gợi ý sửa chữa" },
        },
        required: ["type", "severity", "description", "location", "suggestion"],
        additionalProperties: false,
      },
    },
    summary: {
      type: "string",
      description: "Tóm tắt đánh giá tổng thể",
    },
  },
  required: ["overallScore", "issues", "summary"],
  additionalProperties: false,
});

export const rewriteOutputSchema = jsonSchema<RewriteAgentOutput>({
  type: "object",
  properties: {
    rewrittenContent: {
      type: "string",
      description: "Nội dung chương đã viết lại hoàn chỉnh",
    },
    changesSummary: {
      type: "string",
      description: "Tóm tắt các thay đổi đã thực hiện",
    },
  },
  required: ["rewrittenContent", "changesSummary"],
  additionalProperties: false,
});
