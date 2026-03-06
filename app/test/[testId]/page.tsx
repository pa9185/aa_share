"use client";

import { useQuery } from "convex/react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Navbar } from "@/components/navbar";
import { TestTaking } from "@/components/test-taking";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function TestPage() {
  const { testId } = useParams<{ testId: string }>();
  const searchParams = useSearchParams();
  const isRetest = searchParams.get("retest") === "1";
  const router = useRouter();

  const test = useQuery(api.tests.getTest, { testId: testId as Id<"tests"> });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 max-w-2xl">
        {test === undefined ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !test ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              找不到該考題
            </CardContent>
          </Card>
        ) : test.status === "generating" ? (
          <Card className="border-primary/30">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div>
                <p className="font-semibold text-foreground text-lg">正在生成考題...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {test.progressMessage ?? "請稍候，完成後頁面將自動更新"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                （此頁面透過 Convex 即時更新，無需重新整理）
              </p>
            </CardContent>
          </Card>
        ) : test.status === "error" ? (
          <Card className="border-destructive/30">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">生成失敗</p>
                  <p className="text-sm mt-1 text-muted-foreground">{test.errorMessage}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => router.push("/")} className="w-full">
                回首頁
              </Button>
            </CardContent>
          </Card>
        ) : test.questions ? (
          <TestTaking
            key={isRetest ? `retest-${Date.now()}` : testId}
            testId={testId as Id<"tests">}
            title={test.title}
            questions={test.questions}
          />
        ) : null}
      </main>
    </div>
  );
}
