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
      subject: `Message from ${name} via Game of Trivia`,
      text: `You have a new contact form submission.\n\nName: ${name}\nEmail: ${email}\n\n---\n\n${message}\n\n---\nReply directly to this email to respond to ${name}.`,
    });

    return { success: true };
  } catch {
    return { error: "Failed to send message." };
  }
}
