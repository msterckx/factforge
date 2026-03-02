"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactEmail(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  if (!name || !email || !message) {
    return { error: "All fields are required." };
  }

  try {
    await resend.emails.send({
      from: "Game of Trivia <noreply@gameoftrivia.com>",
      to: "info@gameoftrivia.com",
      replyTo: email,
      subject: `Contact form: message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });

    return { success: true };
  } catch {
    return { error: "Failed to send message." };
  }
}
