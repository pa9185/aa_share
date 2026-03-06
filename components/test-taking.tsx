"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Clock, Send, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getUserId } from "@/lib/user-id";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface TestTakingProps {
  testId: Id<"tests">;
  title: string;
  questions: Question[];
}

const OPTION_LABELS = ["A", "B", "C", "D"];

export function TestTaking({ testId, title, questions }: TestTakingProps) {
  const router = useRouter();
  const createAttempt = useMutation(api.attempts.createAttempt);

  const [answers, setAnswers] = useState<number[]>(
    () => new Array(questions.length).fill(-1)
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  // Timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const answered = answers.filter((a) => a !== -1).length;
  const progress = (answered / questions.length) * 100;
  const current = questions[currentIdx];

  function selectAnswer(optionIdx: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIdx] = optionIdx;
      return next;
    });
  }

  async function handleSubmit() {
    if (answered < questions.length) {
      const unanswered = questions.length - answered;
      toast.warning(`還有 ${unanswered} 題未作答，確定要提交嗎？`, {
        action: {
          label: "確定提交",
          onClick: () => doSubmit(),
        },
      });
      return;
    }
    doSubmit();
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      const userId = getUserId();
      const score = answers.reduce((acc, ans, i) => {
        return acc + (ans === questions[i].correctAnswer ? 1 : 0);
      }, 0);

      const attemptId = await createAttempt({
        testId,
        userId,
        answers,
        score,
        totalQuestions: questions.length,
        timeSpent: Math.floor((Date.now() - startTime.current) / 1000),
        shareToken: uuidv4(),
      });

      router.push(`/result/${attemptId}`);
    } catch {
      toast.error("提交失敗，請稍後再試");
      setSubmitting(false);
    }
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground line-clamp-1">{title}</h1>
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Clock className="h-4 w-4" />
            <span className="tabular-nums">{formatTime(elapsed)}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>已作答 {answered} / {questions.length} 題</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Question navigation pills */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIdx(i)}
            className={cn(
              "h-7 w-7 rounded-full text-xs font-semibold transition-colors",
              i === currentIdx
                ? "bg-primary text-primary-foreground"
                : answers[i] !== -1
                  ? "bg-accent text-accent-foreground border border-primary/30"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Current question */}
      <Card className="shadow-sm">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <Badge variant="accent" className="shrink-0 mt-0.5">
              第 {currentIdx + 1} 題
            </Badge>
            <p className="text-base font-medium leading-relaxed text-foreground">
              {current.question}
            </p>
          </div>

          <div className="space-y-2.5">
            {current.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => selectAnswer(i)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all",
                  answers[currentIdx] === i
                    ? "border-primary bg-accent text-accent-foreground font-medium"
                    : "border-border hover:border-primary/50 hover:bg-accent/30 text-foreground"
                )}
              >
                <span className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  answers[currentIdx] === i
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40 text-muted-foreground"
                )}>
                  {OPTION_LABELS[i]}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setCurrentIdx((i) => i - 1)}
          disabled={currentIdx === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> 上一題
        </Button>

        {currentIdx < questions.length - 1 ? (
          <Button onClick={() => setCurrentIdx((i) => i + 1)} className="gap-1">
            下一題 <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
          >
            {submitting ? (
              <>提交中...</>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                提交答案
              </>
            )}
          </Button>
        )}
      </div>

      {/* Submit button (always visible) */}
      {currentIdx < questions.length - 1 && (
        <Button
          variant="outline"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full gap-1.5"
        >
          <Send className="h-4 w-4" />
          {answered === questions.length ? "提交答案" : `提交答案（${questions.length - answered} 題未作答）`}
        </Button>
      )}
    </div>
  );
}
