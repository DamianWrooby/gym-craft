import Stripe from 'stripe';
import { SECRET_STRIPE_KEY } from '$env/static/private';

// apiVersion pinned to the literal the installed stripe SDK's types expect.
export const stripe = new Stripe(SECRET_STRIPE_KEY, { apiVersion: '2026-06-24.dahlia' });
