"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import {
  Play, Share2, Trash2, Loader2, AlertCircle, FileText,
  CheckCircle2, Clock, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareDialog } from "@/components/share-dialog";
import { formatDate, getScoreLabel } from "@/lib/utils";
import { getUserId } from "@/lib/user-id";
import { cn } from "@/lib/utils";

interface TestCardProps {
  testId: Id<"tests">;
}

export function TestCard({ testId }: TestCardProps) {
  const router = useRouter();
  const test = useQuery(api.tests.getTest, { testId });
  const deleteTest = useMutation(api.tests.deleteTest);
  const userId = typeof window !== "undefined" ? getUserId() : "";

  const bestAttempt = useQuery(api.attempts.getBestAttempt, { testId, userId });
  const [shareOpen, setShareOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (test === undefined) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-9" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!test) return null;

  async function handleDelete() {
    if (!confirm("確定要刪除這個考題嗎？此操作無法復原。")) return;
    setDeleting(true);
    try {
      await deleteTest({ testId, userId });
      toast.success("考題已刪除");
    } catch {
      toast.error("刪除失敗");
      setDeleting(false);
    }
  }

  const isReady = test.status === "ready";
  const isGenerating = test.status === "generating";
  const isError = test.status === "error";

  const bestPct = bestAttempt
    ? Math.round((bestAttempt.score / bestAttempt.totalQuestions) * 100)
    : null;

  return (
    <>
      <Card
        className={cn(
          "shadow-sm transition-shadow hover:shadow-md",
          isGenerating && "border-primary/30",
          isError && "border-destructive/30"
        )}
      >
        <CardContent className="p-4 space-y-3">
          {/* Title & status */}
          <div className="flex items-start gap-2 justify-between">
            <div className="flex items-start gap-2 min-w-0">
              <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
                {test.title}
              </p>
            </div>

            {isGenerating && (
              <Badge variant="accent" className="shrink-0 gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> 生成中
              </Badge>
            )}
            {isReady && (
              <Badge variant="success" className="shrink-0 gap-1">
                <CheckCircle2 className="h-3 w-3" /> 就緒
              </Badge>
            )}
            {isError && (
              <Badge variant="destructive" className="shrink-0 gap-1">
                <AlertCircle className="h-3 w-3" /> 錯誤
              </Badge>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(test.createdAt)}
            </span>
            <span>{test.questionCount} 題</span>
            {bestPct !== null && (
              <span className={cn("font-medium", getScoreLabel(bestPct).color)}>
                最佳 {bestPct}%
              </span>
            )}
          </div>

          {/* Live progress message */}
          {isGenerating && test.progressMessage && (
            <p className="text-xs text-accent-foreground bg-accent rounded px-2 py-1">
              {test.progressMessage}
            </p>
          )}
          {isError && test.errorMessage && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 line-clamp-2">
              {test.errorMessage}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              disabled={!isReady}
              onClick={() => router.push(`/test/${testId}`)}
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {isGenerating ? "等待生成..." : "開始作答"}
              {isReady && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
            </Button>

            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              disabled={!isReady}
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isReady && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          type="test"
          token={test.shareToken}
          title={test.title}
        />
      )}
    </>
  );
}
