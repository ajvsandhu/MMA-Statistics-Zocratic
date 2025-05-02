import { contactFormSchema } from '@/lib/schemas'
import { NextResponse } from 'next/server'

// Set this to your Cloudflare email alias (e.g., contact@yourdomain.com)
const RECIPIENT_EMAIL = "contact@zocraticmma.com"

export async function POST(request: Request) {
  try {
    // Parse and validate the form data
    const body = await request.json()
    const result = contactFormSchema.safeParse(body)
    
    if (!result.success) {
      // Return validation errors
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      )
    }

    const { email, subject, message } = result.data
    
    // In a production environment, you would send the email here
    // Example implementation with a third-party service:
    
    /*
    // Example with a service like SendGrid or Mailgun
    const emailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: RECIPIENT_EMAIL }],
            subject: `Contact Form: ${subject}`,
          },
        ],
        from: { email: 'noreply@yourdomain.com', name: 'Your Website' },
        reply_to: { email, name: email.split('@')[0] },
        content: [
          {
            type: 'text/plain',
            value: `From: ${email}\n\n${message}`,
          },
        ],
      }),
    });
    */
    
    // For now, we'll just log the data
    console.log({
      to: RECIPIENT_EMAIL,
      from: email,
      subject,
      message
    })

    // Return a success response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing contact form:', error)
    return NextResponse.json(
      { error: "Failed to process contact form" },
      { status: 500 }
    )
  }
} 