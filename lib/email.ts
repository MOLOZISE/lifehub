import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? "LifeHub <onboarding@resend.dev>";
const BASE_URL = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${BASE_URL}/api/auth/verify-email/${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "[LifeHub] 이메일 인증을 완료해주세요",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin-bottom: 8px;">LifeHub 이메일 인증</h2>
        <p style="color: #666; margin-bottom: 24px;">아래 버튼을 눌러 이메일 인증을 완료하고 LifeHub를 이용해보세요.</p>
        <a href="${url}"
          style="display: inline-block; padding: 12px 28px; background: #6366f1; color: #fff;
                 text-decoration: none; border-radius: 8px; font-weight: 600;">
          이메일 인증하기
        </a>
        <p style="margin-top: 24px; color: #999; font-size: 13px;">
          이 링크는 24시간 후 만료됩니다.<br/>
          본인이 요청하지 않은 경우 이 메일을 무시하세요.
        </p>
      </div>
    `,
  });
}
