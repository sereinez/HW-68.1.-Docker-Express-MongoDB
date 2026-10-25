import nodemailer from 'nodemailer';

// Якщо SMTP не налаштований — лист не надсилається, а виводиться в консоль (зручно для розробки).
const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

export async function sendMail({ to, subject, text }) {
  if (!transport) {
    console.log(`\n[MAIL] SMTP не налаштований — лист виведено в консоль\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }

  await transport.sendMail({
    from: process.env.MAIL_FROM || 'Express Passport <no-reply@example.com>',
    to,
    subject,
    text,
  });
}
