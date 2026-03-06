"use client";

import { useState } from "react";
import { Copy, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { generateShareUrl } from "@/lib/utils";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "test" | "result";
  token: string;
  title?: string;
}

export function ShareDialog({ open, onOpenChange, type, token, title }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const url = generateShareUrl(type, token);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("連結已複製到剪貼簿");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("複製失敗，請手動複製");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            {type === "test" ? "分享考題" : "分享成績"}
          </DialogTitle>
          <DialogDescription>
            {title && <span className="font-medium text-foreground">「{title}」</span>}
            {type === "test"
              ? " — 任何人點擊連結都可以作答"
              : " — 任何人點擊連結都可以查看成績"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="share-url">分享連結</Label>
            <div className="flex gap-2">
              <Input
                id="share-url"
                readOnly
                value={url}
                className="text-xs text-muted-foreground"
              />
              <Button onClick={copyUrl} size="icon" variant="outline" className="shrink-0">
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {type === "test"
              ? "連結永久有效，收到連結的人不需要登入即可作答。"
              : "連結永久有效，收到連結的人可以查看完整作答記錄。"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
