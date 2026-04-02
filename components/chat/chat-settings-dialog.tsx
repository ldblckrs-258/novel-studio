import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";

export function ChatSettingsDialog({
  open,
  onOpenChange,
  providers,
  models,
  selectedProviderId,
  onProviderChange,
  selectedModelId,
  onModelChange,
  systemPrompt,
  onSystemPromptChange,
  temperature,
  onTemperatureChange,
  maxToolSteps,
  onMaxToolStepsChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: { id: string; name: string }[];
  models: { id: string; modelId: string; name: string }[];
  selectedProviderId: string;
  onProviderChange: (id: string) => void;
  selectedModelId: string;
  onModelChange: (id: string) => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  maxToolSteps: number;
  onMaxToolStepsChange: (steps: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cài đặt trò chuyện</DialogTitle>
          <DialogDescription>
            Cấu hình mô hình AI và hành vi cho cuộc trò chuyện.
          </DialogDescription>
        </DialogHeader>
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel>Nhà cung cấp</FieldLabel>
              {providers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa cấu hình nhà cung cấp. Thêm trong Cài đặt.
                </p>
              ) : (
                <NativeSelect
                  className="w-full"
                  value={selectedProviderId}
                  onChange={(e) => onProviderChange(e.target.value)}
                >
                  {providers.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field>
              <FieldLabel>Mô hình</FieldLabel>
              {models.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Không có mô hình. Tải danh sách mô hình từ nhà cung cấp.
                </p>
              ) : (
                <NativeSelect
                  className="w-full"
                  value={selectedModelId}
                  onChange={(e) => onModelChange(e.target.value)}
                >
                  {models.map((m) => (
                    <NativeSelectOption key={m.id} value={m.modelId}>
                      {m.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Separator />
            <Field>
              <FieldLabel>Chỉ thị hệ thống</FieldLabel>
              <textarea
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                rows={3}
                className="field-sizing-content max-h-40 min-h-16 w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Chỉ thị cho trợ lý AI..."
              />
              <FieldDescription>
                Thiết lập hành vi và tính cách của AI.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>
                Temperature{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {temperature.toFixed(1)}
                </span>
              </FieldLabel>
              <Input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) =>
                  onTemperatureChange(parseFloat(e.target.value))
                }
                className="h-2 cursor-pointer accent-primary"
              />
              <FieldDescription>
                Thấp = tập trung hơn, cao = sáng tạo hơn.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>
                Giới hạn bước công cụ{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {maxToolSteps}
                </span>
              </FieldLabel>
              <Input
                type="range"
                min={5}
                max={20}
                step={1}
                value={maxToolSteps}
                onChange={(e) => onMaxToolStepsChange(parseInt(e.target.value))}
                className="h-2 cursor-pointer accent-primary"
              />
              <FieldDescription>
                Số lần AI được gọi công cụ tra cứu trong một tin nhắn.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </FieldSet>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Xong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
