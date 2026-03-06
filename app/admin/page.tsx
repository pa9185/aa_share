"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Navbar } from "@/components/navbar";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard, FileText, FlaskConical, Users, Coins, Cpu, Lock,
} from "lucide-react";
import { formatDate, formatDateShort } from "@/lib/utils";
import { cn } from "@/lib/utils";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-lg bg-accent p-2.5">
          <Icon className="h-5 w-5 text-accent-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value.toLocaleString()}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AdminAuth({ onAuth }: { onAuth: (secret: string) => void }) {
  const [input, setInput] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> 管理員登入
          </CardTitle>
          <CardDescription>輸入管理員密碼以繼續</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="secret">密碼</Label>
            <Input
              id="secret"
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAuth(input)}
            />
          </div>
          <Button className="w-full" onClick={() => onAuth(input)}>
            登入
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
function AdminDashboard({ secret }: { secret: string }) {
  const isAdmin = useQuery(api.admin.verifyAdminSecret, { secret });
  const stats = useQuery(api.admin.getStats, {});
  const tests = useQuery(api.admin.getAllTests, { limit: 30 });
  const tokenHistory = useQuery(api.admin.getTokenUsageHistory, { limit: 20 });
  const modelBreakdown = useQuery(api.admin.getModelBreakdown, {});

  if (isAdmin === undefined || isAdmin === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-destructive font-medium">
          {isAdmin === false ? "密碼錯誤，請重新整理頁面並輸入正確密碼。" : "驗證中..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <section className="space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-primary" /> 概覽
        </h2>
        {stats === undefined ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard icon={FileText} label="PDF 檔案" value={stats.totalPdfs} />
            <StatCard
              icon={FlaskConical}
              label="考題"
              value={stats.totalTests}
              sub={`${stats.readyTests} 就緒・${stats.errorTests} 錯誤`}
            />
            <StatCard icon={Users} label="作答次數" value={stats.totalAttempts} />
            <StatCard
              icon={Coins}
              label="總 token 消耗"
              value={stats.totalTokens.toLocaleString()}
              sub={`提示詞 ${stats.promptTokens.toLocaleString()} / 回應 ${stats.completionTokens.toLocaleString()}`}
            />
          </div>
        )}
      </section>

      {/* Model breakdown */}
      {modelBreakdown && Object.keys(modelBreakdown).length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" /> 模型使用分佈
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(modelBreakdown as Record<string, { count: number; totalTokens: number }>).map(([model, data]) => (
              <Card key={model} className="flex-1 min-w-[180px]">
                <CardContent className="p-3">
                  <p className="text-xs font-mono text-accent-foreground truncate">{model}</p>
                  <p className="text-lg font-bold text-foreground">{data.totalTokens.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{data.count} 次生成</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Token usage history */}
      <section className="space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" /> Token 消耗記錄
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>模型</TableHead>
                <TableHead className="text-right">提示詞</TableHead>
                <TableHead className="text-right">回應</TableHead>
                <TableHead className="text-right">合計</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokenHistory === undefined ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    載入中...
                  </TableCell>
                </TableRow>
              ) : tokenHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    尚無記錄
                  </TableCell>
                </TableRow>
              ) : (
                (tokenHistory as NonNullable<typeof tokenHistory>).map((r: any) => (
                  <TableRow key={r._id}>
                    <TableCell className="text-xs">{formatDateShort(r.createdAt)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">
                      {r.model}
                    </TableCell>
                    <TableCell className="text-right text-xs">{r.promptTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs">{r.completionTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs font-semibold text-foreground">
                      {r.totalTokens.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* All tests */}
      <section className="space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" /> 所有考題（最近 30 筆）
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>標題</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">題數</TableHead>
                <TableHead className="text-right">Token</TableHead>
                <TableHead>建立時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests === undefined ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    載入中...
                  </TableCell>
                </TableRow>
              ) : tests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    尚無考題
                  </TableCell>
                </TableRow>
              ) : (
                (tests as NonNullable<typeof tests>).map((t: any) => (
                  <TableRow key={t._id}>
                    <TableCell className="max-w-[200px] truncate text-sm font-medium">
                      {t.title}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "ready"
                            ? "success"
                            : t.status === "error"
                              ? "destructive"
                              : "accent"
                        }
                      >
                        {t.status === "ready" ? "就緒" : t.status === "error" ? "錯誤" : "生成中"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{t.questionCount}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {t.tokensUsed?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateShort(t.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_secret");
    if (saved) setSecret(saved);
  }, []);

  if (!secret) {
    return (
      <AdminAuth
        onAuth={(s) => {
          sessionStorage.setItem("admin_secret", s);
          setSecret(s);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">管理員後台</h1>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              sessionStorage.removeItem("admin_secret");
              setSecret(null);
            }}
          >
            登出
          </Button>
        </div>
        <AdminDashboard secret={secret} />
      </main>
    </div>
  );
}
