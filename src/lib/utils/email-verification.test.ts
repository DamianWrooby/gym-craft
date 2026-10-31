import { describe, expect, it } from 'vitest';
import { generateEmailTemplate } from './email-verification';

describe('generateEmailTemplate', () => {
    it('links to the verify page with the user id and token', () => {
        const html = generateEmailTemplate('https://example.com', 'user-1', 'abc');
        expect(html).toContain('href="https://example.com/verify/user-1/abc"');
        expect(html).toContain('Activate your account');
    });
});
