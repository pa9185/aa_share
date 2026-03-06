"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Navbar } from "@/components/navbar";
import { ResultView } from "@/components/result-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const attempt = useQuery(api.attempts.getAttempt, {
    attemptId: attemptId as Id<"attempts">,
  });

  const test = useQuery(
    api.tests.getTest,
    attempt ? { testId: attempt.testId } : "skip"
  );

  const isLoading = attempt === undefined || (attempt && test === undefined);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 max-w-2xl">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !attempt ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              找不到該成績記錄
            </CardContent>
          </Card>
        ) : !test || !test.questions ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
              <AlertCircle className="h-5 w-5 shrink-0" />
              考題資料無法讀取
            </CardContent>
          </Card>
        ) : (
          <ResultView
            attemptId={attemptId as Id<"attempts">}
            testId={attempt.testId}
            testTitle={test.title}
            questions={test.questions}
            answers={attempt.answers}
            score={attempt.score}
            totalQuestions={attempt.totalQuestions}
            timeSpent={attempt.timeSpent}
            shareToken={attempt.shareToken}
            testShareToken={test.shareToken}
            completedAt={attempt.completedAt}
          />
        )}
      </main>
    </div>
  );
}
