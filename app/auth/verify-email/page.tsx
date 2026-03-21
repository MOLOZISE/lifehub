"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function VerifyContent() {
  const params = useSearchParams();
  const success = params.get("success");
  const error = params.get("error");

  if (success) {
    return (
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <CheckCircle2 className="w-14 h-14 text-green-500" />
        </div>
        <h2 className="text-lg font-bold">이메일 인증 완료!</h2>
        <p className="text-sm text-muted-foreground">이제 로그인하여 LifeHub를 이용할 수 있습니다.</p>
        <Button asChild className="mt-2">
          <Link href="/auth/signin">로그인하기</Link>
        </Button>
      </div>
    );
  }

  if (error === "expired") {
    return (
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <XCircle className="w-14 h-14 text-destructive" />
        </div>
        <h2 className="text-lg font-bold">링크가 만료되었습니다</h2>
        <p className="text-sm text-muted-foreground">인증 링크는 24시간 후 만료됩니다.<br />다시 회원가입해주세요.</p>
        <Button variant="outline" asChild className="mt-2">
          <Link href="/auth/signup">다시 회원가입</Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <XCircle className="w-14 h-14 text-destructive" />
        </div>
        <h2 className="text-lg font-bold">유효하지 않은 링크입니다</h2>
        <p className="text-sm text-muted-foreground">링크가 올바르지 않거나 이미 사용되었습니다.</p>
        <Button variant="outline" asChild className="mt-2">
          <Link href="/auth/signin">로그인 페이지로</Link>
        </Button>
      </div>
    );
  }

  // 이메일 발송 후 안내 (파라미터 없음)
  return (
    <div className="text-center space-y-3">
      <div className="flex justify-center">
        <Mail className="w-14 h-14 text-primary" />
      </div>
      <h2 className="text-lg font-bold">이메일을 확인해주세요</h2>
      <p className="text-sm text-muted-foreground">
        가입하신 이메일로 인증 링크를 발송했습니다.<br />
        링크를 클릭하면 가입이 완료됩니다.
      </p>
      <p className="text-xs text-muted-foreground">메일이 오지 않으면 스팸 폴더를 확인하세요.</p>
      <Button variant="ghost" asChild className="mt-2">
        <Link href="/auth/signin">로그인 페이지로</Link>
      </Button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">LifeHub</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <VerifyContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
