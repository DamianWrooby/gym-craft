import nodemailer from 'nodemailer';
import mg from 'nodemailer-mailgun-transport';
import { SECRET_MAILGUN_API_KEY, SECRET_MAILGUN_DOMAIN } from '$env/static/private';
import { appConfig } from '@/constants/app.constants';
import { generateEmailTemplate } from '$lib/utils/email-verification';
import { PUBLIC_APP_ENV } from '$env/static/public';
import { error } from '@sveltejs/kit';
import { db } from '$lib/database';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const auth = {
    auth: {
        api_key: SECRET_MAILGUN_API_KEY,
        domain: SECRET_MAILGUN_DOMAIN,
    },
    host: 'api.eu.mailgun.net',
};

const transporter = nodemailer.createTransport(mg(auth));

export async function sendVerificationToken(userId: string, email: string) {
    try {
        // Verify email
        await verifyEmail(userId, email);

        // Generate a secure random token
        const token = crypto.randomBytes(32).toString('hex');

        // Hash the token using bcrypt
        const tokenHash = await bcrypt.hash(token, 10);

        // Set the expiration date, e.g., 1 hour from now
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        // Save the token in the database
        const verificationToken = await db.verificationToken.create({
            data: {
                userId: userId,
                tokenHash: tokenHash,
                expiresAt: expiresAt,
            },
        });

        // Send the raw token to the user (not the hash)
        sendVerificationEmail(email, userId, token);

        return verificationToken;
    } catch (err) {
        console.log('Error in sendVerificationToken:', err);
        if (err) throw error(500, 'Error in sendVerificationToken');
    }
}

const sendVerificationEmail = (email: string, userId: string, token: string) => {
    const baseUrl = PUBLIC_APP_ENV === 'development' ? appConfig.baseAppUrlDEV : appConfig.baseAppUrlPROD;
    const html = generateEmailTemplate(baseUrl, userId, token);

    sendMail(email, html);
};

const sendMail = (to: string, content: string) =>
    transporter.sendMail(
        {
            from: 'GymCraft <no-reply@gymcraft.damianwroblewski.com>',
            to,
            subject: 'GymCraft - Activate your account',
            html: content,
        },
        (err) => {
            if (err) {
                console.error('Mail provider error:', err);
                throw error(400, 'Mail provider error');
            } else {
                console.log('Email sent successfully');
            }
        },
    );

const verifyEmail = async (userId: string, email: string) => {
    try {
        const user = await db.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true },
        });
        if (!user) throw error(404, 'User not found');
        if (user.email !== email) throw error(500, 'Email mismatch');
    } catch (err) {
        throw error(500, 'Database error');
    }
};
