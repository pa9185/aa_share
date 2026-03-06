"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Navbar } from "@/components/navbar";
import { ResultView } from "@/components/result-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

export default function SharedResultPage() {
  const { token } = useParams<{ token: string }>();

  const attempt = useQuery(api.attempts.getAttemptByShareToken, { shareToken: token });
  const test = useQuery(
    api.tests.getTest,
    attempt ? { testId: attempt.testId } : "skip"
  );

  const isLoading = attempt === undefined || (attempt && test === undefined);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 max-w-2xl">
        <div className="mb-6 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
          這是別人分享給您的成績記錄（唯讀）。
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !attempt ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              找不到該分享連結，可能已被刪除
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
            attemptId={attempt._id as Id<"attempts">}
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
            readOnly
          />
        )}
      </main>
    </div>
  );
}
