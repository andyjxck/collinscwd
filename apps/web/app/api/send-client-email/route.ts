import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "Collins CWD <noreply@collinscwd.co.uk>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://collinscwd.co.uk";

function buildEmailHtml(subject: string, body: string, clientName: string): string {
  // Convert plain newlines to <br> for HTML
  const htmlBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#0d1117;padding:28px 36px;text-align:left;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <div style="width:42px;height:42px;background:#1a2236;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                      <img src="${SITE_URL}/logomaybe.png" alt="Collins" width="42" height="42" style="display:block;border-radius:10px;" />
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:18px;font-weight:700;color:#e8ecf8;letter-spacing:-0.3px;">Collins CW&amp;D</div>
                    <div style="font-size:12px;color:rgba(232,236,248,0.45);margin-top:2px;">Client Communication</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subject band -->
          <tr>
            <td style="background:#f8f9fc;padding:16px 36px;border-bottom:1px solid #eaecf2;">
              <div style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Message for</div>
              <div style="font-size:16px;font-weight:700;color:#111827;">${clientName}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <div style="font-size:15px;color:#374151;line-height:1.7;">
                ${htmlBody}
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:#eaecf2;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 36px;text-align:left;">
              <div style="font-size:12px;color:#9ca3af;line-height:1.6;">
                This email was sent by Collins CW&amp;D on behalf of your project team.<br />
                You can view your job status at any time in your
                <a href="${SITE_URL}/portal/client" style="color:#2a5bff;text-decoration:none;">client portal</a>.
              </div>
              <div style="margin-top:16px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px;">
                      <div style="width:28px;height:28px;background:#0d1117;border-radius:7px;overflow:hidden;">
                        <img src="${SITE_URL}/logomaybe.png" alt="" width="28" height="28" style="display:block;border-radius:7px;" />
                      </div>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:12px;font-weight:700;color:#374151;">Collins CW&amp;D</div>
                      <div style="font-size:11px;color:#9ca3af;">Carpenters, Windows &amp; Doors</div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  const { toEmail, toName, subject, body } = await request.json();

  if (!toEmail || !subject || !body) {
    return NextResponse.json({ error: "toEmail, subject, and body are required" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured (missing RESEND_API_KEY)" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = buildEmailHtml(subject, body, toName ?? toEmail);

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: [toEmail],
    subject,
    html,
    text: body,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
