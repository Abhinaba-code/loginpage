
'use server';
/**
 * @fileOverview A flow for sending and verifying one-time passwords (OTPs) via email for passwordless authentication.
 *
 * - sendOtpFlow: Generates an OTP, stores it, and sends it to the user's email.
 * - verifyOtpFlow: Verifies the user's provided OTP and returns a custom Firebase auth token if valid.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// In-memory store for OTPs. In a production app, use Firestore or Redis.
const otpStore: Record<string, { code: string; expires: number; attempts: number }> = {};

const SendOtpInputSchema = z.object({
  email: z.string().email().describe('The email address to send the OTP to.'),
});

const SendOtpOutputSchema = z.object({
    success: z.boolean(),
    otp: z.string().optional().describe("The OTP code, returned for dev/testing purposes."),
});


const VerifyOtpInputSchema = z.object({
  email: z.string().email().describe('The user\'s email address.'),
  otp: z.string().length(6).describe('The 6-digit one-time password.'),
});

const VerifyOtpOutputSchema = z.object({
  token: z.string().optional().describe('The custom Firebase authentication token, if verification is successful.'),
  error: z.string().optional().describe('An error message if verification fails.'),
});

if (!getApps().length) {
    initializeApp();
}

/**
 * Generates a random 6-digit OTP.
 */
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const sendEmailTool = ai.defineTool(
    {
        name: 'sendEmailTool',
        description: 'Sends an email to a recipient.',
        inputSchema: z.object({
            to: z.string().email(),
            subject: z.string(),
            body: z.string(),
        }),
        outputSchema: z.object({ success: z.boolean() }),
    },
    async (input) => {
        // This is a mock. In a real app, you would integrate with an email service
        // like SendGrid, Nodemailer, or AWS SES.
        console.log('------- MOCK EMAIL SENDER -------');
        console.log(`To: ${input.to}`);
        console.log(`Subject: ${input.subject}`);
        console.log('Body:');
        console.log(input.body);
        console.log('---------------------------------');
        // Let's assume the email is always sent successfully in this mock.
        return { success: true };
    }
);


export const sendOtpFlow = ai.defineFlow(
  {
    name: 'sendOtpFlow',
    inputSchema: SendOtpInputSchema,
    outputSchema: SendOtpOutputSchema,
  },
  async ({ email }) => {
    const otp = generateOtp();
    const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store the OTP
    otpStore[email] = { code: otp, expires: expirationTime, attempts: 0 };
    
    // In a real app, use a proper email sending service.
    const result = await sendEmailTool({
        to: email,
        subject: 'Your AuthFlow One-Time Password',
        body: `Your one-time password is: ${otp}\nThis code will expire in 10 minutes.`
    });

    if (!result.success) {
        throw new Error('Failed to send OTP email.');
    }
    
    // For development, we return the OTP to be displayed in the UI.
    // In production, this should be removed.
    const isDev = process.env.NODE_ENV === 'development';
    return { success: true, otp: isDev ? otp : undefined };
  }
);

export const verifyOtpFlow = ai.defineFlow(
  {
    name: 'verifyOtpFlow',
    inputSchema: VerifyOtpInputSchema,
    outputSchema: VerifyOtpOutputSchema,
  },
  async ({ email, otp }) => {
    const storedOtp = otpStore[email];

    if (!storedOtp) {
      return { error: 'No OTP found for this email. Please request a new one.' };
    }

    if (Date.now() > storedOtp.expires) {
      delete otpStore[email];
      return { error: 'OTP has expired. Please request a new one.' };
    }

    if (storedOtp.attempts >= 5) {
        delete otpStore[email];
        return { error: 'Too many failed attempts. Please request a new OTP.' };
    }

    if (storedOtp.code !== otp) {
      storedOtp.attempts++;
      return { error: 'Invalid OTP. Please try again.' };
    }

    // OTP is correct, clean up and generate a custom token.
    delete otpStore[email];

    const auth = getAuth();
    try {
        let user = await auth.getUserByEmail(email).catch(() => null);

        // If user doesn't exist, create one
        if (!user) {
            user = await auth.createUser({ email: email });
        }
        
        const customToken = await auth.createCustomToken(user.uid);
        return { token: customToken };

    } catch (error: any) {
        console.error("Error creating custom token:", error);
        return { error: 'Failed to create authentication token.' };
    }
  }
);
