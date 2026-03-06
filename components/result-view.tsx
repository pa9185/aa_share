"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, Trophy, RotateCcw, Share2, ChevronDown, ChevronUp, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShareDialog } from "@/components/share-dialog";
import { cn, getScoreLabel, formatDate } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface ResultViewProps {
  attemptId: Id<"attempts">;
  testId: Id<"tests">;
  testTitle: string;
  questions: Question[];
  answers: number[];
  score: number;
  totalQuestions: number;
  timeSpent?: number;
  shareToken: string;
  testShareToken: string;
  completedAt: number;
  readOnly?: boolean;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

function ScoreCircle({ score, total }: { score: number; total: number }) {
  const pct = Math.round((score / total) * 100);
  const { label, color } = getScoreLabel(pct);
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center">
        <svg width="110" height="110" className="-rotate-90">
          <circle cx="55" cy="55" r="40" stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
          <circle
            cx="55" cy="55" r="40"
            stroke="hsl(var(--primary))" strokeWidth="8" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute text-center">
          <div className="text-2xl font-bold text-foreground">{pct}%</div>
          <div className={cn("text-xs font-medium", color)}>{label}</div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        答對 <span className="font-semibold text-foreground">{score}</span> / {total} 題
      </p>
    </div>
  );
}

export function ResultView({
  attemptId, testId, testTitle, questions, answers, score,
  totalQuestions, timeSpent, shareToken, testShareToken, completedAt, readOnly,
}: ResultViewProps) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const formatTime = (s: number) => {
    if (s < 60) return `${s} 秒`;
    return `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Score summary */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              測驗結果
            </CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {timeSpent ? formatTime(timeSpent) : "—"}
            </div>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">{testTitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center py-2">
            <ScoreCircle score={score} total={totalQuestions} />
          </div>

          <p className="text-xs text-center text-muted-foreground">
            {formatDate(completedAt)}
          </p>

          {!readOnly && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {/* Retest with single tap */}
              <Button
                onClick={() => router.push(`/test/${testId}?retest=1`)}
                className="flex-1 gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                再測一次
              </Button>

              <Button
                variant="outline"
                onClick={() => setShareOpen(true)}
                className="flex-1 gap-2"
              >
                <Share2 className="h-4 w-4" />
                分享成績
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question review */}
      <div className="space-y-3">
        <h2 className="font-semibold text-foreground">逐題解析</h2>
        {questions.map((q, i) => {
          const userAns = answers[i] ?? -1;
          const isCorrect = userAns === q.correctAnswer;
          const isExpanded = expandedIdx === i;

          return (
            <Card
              key={q.id}
              className={cn(
                "shadow-sm transition-colors",
                isCorrect ? "border-green-500/30" : "border-destructive/30"
              )}
            >
              <button
                className="w-full text-left"
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">第 {i + 1} 題</span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium leading-snug text-foreground line-clamp-2">
                        {q.question}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </button>

              {isExpanded && (
                <>
                  <Separator />
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-2">
                      {q.options.map((opt, j) => (
                        <div
                          key={j}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                            j === q.correctAnswer
                              ? "bg-green-500/10 text-green-700 dark:text-green-400 font-medium"
                              : userAns === j && !isCorrect
                                ? "bg-destructive/10 text-destructive"
                                : "text-muted-foreground"
                          )}
                        >
                          <span className="font-mono text-xs w-4 shrink-0">
                            {OPTION_LABELS[j]}
                          </span>
                          {opt}
                          {j === q.correctAnswer && (
                            <Badge variant="success" className="ml-auto shrink-0">正確答案</Badge>
                          )}
                          {userAns === j && j !== q.correctAnswer && (
                            <Badge variant="destructive" className="ml-auto shrink-0">你的答案</Badge>
                          )}
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <div className="rounded-lg bg-accent px-3 py-2.5 text-xs text-accent-foreground">
                        <span className="font-semibold">解析：</span>
                        {q.explanation}
                      </div>
                    )}
                  </CardContent>
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bottom actions */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-2 pb-8">
          <Button onClick={() => router.push(`/test/${testId}?retest=1`)} className="flex-1 gap-2">
            <RotateCcw className="h-4 w-4" />
            再測一次
          </Button>
          <Button variant="outline" onClick={() => setShareOpen(true)} className="flex-1 gap-2">
            <Share2 className="h-4 w-4" />
            分享成績
          </Button>
          <Button variant="ghost" onClick={() => router.push("/")} className="flex-1">
            回首頁
          </Button>
        </div>
      )}

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        type="result"
        token={shareToken}
        title={testTitle}
      />
    </div>
  );
}
