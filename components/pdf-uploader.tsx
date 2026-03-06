"use client";

import { useCallback, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import {
  Upload, FileText, Loader2, AlertCircle, X, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/utils";
import { getUserId } from "@/lib/user-id";

type UploadPhase = "idle" | "uploading" | "generating";

export function PdfUploader() {
  const router = useRouter();
  const generateTest = useAction(api.generateTest.generateTest);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [questionCount, setQuestionCount] = useState("10");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      toast.error("請上傳 PDF 格式的檔案");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("檔案大小不能超過 20 MB");
      return;
    }
    setFile(f);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  async function handleGenerate() {
    if (!file) return;
    const userId = getUserId();

    try {
      // ── 1. Upload PDF via Next.js API → S3 ──────────────────────────────
      setPhase("uploading");
      setUploadProgress(10);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(60);

      if (!uploadRes.ok) {
        const { error } = await uploadRes.json();
        throw new Error(error ?? "上傳失敗");
      }

      const { pdfId } = await uploadRes.json();
      setUploadProgress(100);

      // ── 2. Create test record + trigger generation ────────────────────────
      setPhase("generating");

      // Create the test record first via mutation (through the action)
      const shareToken = uuidv4();
      const testId = await generateTest({
        pdfId: pdfId as Id<"pdfs">,
        questionCount: parseInt(questionCount),
        userId,
        shareToken,
        title: file.name.replace(/\.pdf$/i, ""),
      });

      toast.success("考題生成完成！");
      router.push(`/test/${testId}`);
    } catch (err) {
      toast.error(String(err));
      setPhase("idle");
      setUploadProgress(0);
    }
  }

  const isLoading = phase !== "idle";

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3
          rounded-xl border-2 border-dashed p-10 cursor-pointer
          transition-colors duration-200
          ${dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/40"}
          ${isLoading ? "cursor-not-allowed opacity-60" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          disabled={isLoading}
        />

        {file ? (
          <>
            <FileText className="h-10 w-10 text-primary" />
            <div className="text-center">
              <p className="font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            {!isLoading && (
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="absolute right-3 top-3 rounded-full p-1 hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium text-foreground">拖曳或點擊上傳 PDF</p>
              <p className="text-sm text-muted-foreground">最大 20 MB</p>
            </div>
          </>
        )}
      </div>

      {/* Progress */}
      {phase === "uploading" && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>上傳中...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {phase === "generating" && (
        <Card className="border-accent bg-accent">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <Loader2 className="h-4 w-4 animate-spin text-accent-foreground shrink-0" />
            <p className="text-sm text-accent-foreground">
              AI 正在生成題目，完成後將自動跳轉...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Settings & Submit */}
      {file && phase === "idle" && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-3 flex-1">
            <Label htmlFor="q-count" className="whitespace-nowrap text-muted-foreground">
              題目數量
            </Label>
            <Select value={questionCount} onValueChange={setQuestionCount}>
              <SelectTrigger id="q-count" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["5", "10", "15", "20"].map((n) => (
                  <SelectItem key={n} value={n}>{n} 題</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleGenerate} className="gap-2 sm:w-auto w-full">
            生成考題
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!file && !isLoading && (
        <div className="flex items-start gap-2 rounded-lg bg-accent/60 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-accent-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-accent-foreground">
            上傳 PDF 後 AI 將自動擷取內容並生成選擇題，PDF 文字會被快取以節省每次的 token 消耗。
          </p>
        </div>
      )}
    </div>
  );
}
