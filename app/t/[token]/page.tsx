"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Navbar } from "@/components/navbar";
import { TestTaking } from "@/components/test-taking";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

export default function SharedTestPage() {
  const { token } = useParams<{ token: string }>();

  const test = useQuery(api.tests.getTestByShareToken, { shareToken: token });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 max-w-2xl">
        <div className="mb-6 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
          這是別人分享給您的考題，作答後可以查看成績。
        </div>

        {test === undefined ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !test ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              找不到該分享連結，可能已被刪除
            </CardContent>
          </Card>
        ) : test.status !== "ready" || !test.questions ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
              <AlertCircle className="h-5 w-5 shrink-0" />
              考題尚未準備好，請稍後再試
            </CardContent>
          </Card>
        ) : (
          <TestTaking
            testId={test._id as Id<"tests">}
            title={test.title}
            questions={test.questions}
          />
        )}
      </main>
    </div>
  );
}
