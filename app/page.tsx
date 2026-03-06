"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Navbar } from "@/components/navbar";
import { PdfUploader } from "@/components/pdf-uploader";
import { TestCard } from "@/components/test-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserId } from "@/lib/user-id";
import { BookOpen, FilePlus2 } from "lucide-react";

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  const tests = useQuery(
    api.tests.getUserTests,
    userId ? { userId } : "skip"
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8 space-y-8 max-w-3xl">
        {/* Hero */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            考題練習平台
          </h1>
          <p className="text-muted-foreground">
            上傳 PDF，AI 自動分析內容並生成選擇題，支援分享與多次練習。
          </p>
        </div>

        {/* Uploader */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FilePlus2 className="h-5 w-5 text-primary" />
              上傳新的 PDF
            </CardTitle>
            <CardDescription>
              支援最大 20 MB 的 PDF 檔案。PDF 文字會被快取，相同文件不重複消耗 AI token。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PdfUploader />
          </CardContent>
        </Card>

        <Separator />

        {/* Test list */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">我的考題</h2>

          {tests === undefined ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-9 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center gap-3">
              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">還沒有考題</p>
                <p className="text-xs text-muted-foreground mt-1">
                  上傳 PDF 後，AI 生成的考題會顯示在這裡
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {tests.map((test) => (
                <TestCard key={test._id} testId={test._id} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
