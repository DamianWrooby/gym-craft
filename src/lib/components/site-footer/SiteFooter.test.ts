import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SiteFooter from './SiteFooter.svelte';

describe('SiteFooter', () => {
    it('links to the legal pages', () => {
        render(SiteFooter);
        expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy');
        expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms-of-use');
    });
});
