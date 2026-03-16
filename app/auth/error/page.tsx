"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const errorMessages: Record<string, string> = {
  Configuration: "서버 설정에 문제가 있습니다.",
  AccessDenied: "접근이 거부됐습니다.",
  Verification: "인증 링크가 만료됐습니다.",
  Default: "인증 중 오류가 발생했습니다.",
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";
  const message = errorMessages[error] ?? errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
          <CardTitle>인증 오류</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>
          <Link href="/auth/signin" className="inline-flex items-center justify-center w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
            다시 로그인
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
