import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "support.carepath@gmail.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendOtpEmail(toEmail: string, otp: string, doctorName: string): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0f4f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9,#2563eb,#7c3aed);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">CAREPATH AI</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Powered by Codelyne Technologies</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;color:#1e293b;font-size:18px;font-weight:600;">Hello Dr. ${doctorName},</p>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
                We received a request to reset your password. Use the verification code below to set a new password.
              </p>
              <div style="background-color:#f1f5f9;border:2px dashed #cbd5e1;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Your OTP Code</p>
                <p style="margin:0;color:#2563eb;font-size:36px;font-weight:800;letter-spacing:8px;font-family:'Courier New',monospace;">${otp}</p>
              </div>
              <div style="background-color:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 24px;">
                <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
                  ⏰ This code expires in <strong>10 minutes</strong>. Do not share this code with anyone.
                </p>
              </div>
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;">
                If you did not request a password reset, please ignore this email. Your account remains secure.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                &copy; ${new Date().getFullYear()} CarePath AI &bull; All rights reserved
              </p>
              <p style="margin:4px 0 0;color:#cbd5e1;font-size:11px;">
                support.carepath@gmail.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: '"CarePath AI" <support.carepath@gmail.com>',
      to: toEmail,
      subject: `${otp} — Your CarePath AI Password Reset Code`,
      text: `Hello Dr. ${doctorName},\n\nYour password reset OTP is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.\n\n— CarePath AI`,
      html,
    });
    console.log(`[email] OTP sent to ${toEmail}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send OTP:", err);
    return false;
  }
}
