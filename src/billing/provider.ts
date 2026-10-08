export type PlanId = 'free' | 'plus' | 'club';

export interface BillingEntitlementUpdate {
  userId: string;
  planId: PlanId;
  source: 'billing' | 'promotion';
  validUntil: string | null;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
}

export interface BillingProvider {
  createCheckout(input: { userId: string; planId: Exclude<PlanId, 'free'>; returnUrl: string }): Promise<{ url: string }>;
  verifyWebhook(request: Request): Promise<BillingEntitlementUpdate | null>;
}

export class BillingNotConfiguredProvider implements BillingProvider {
  async createCheckout(): Promise<{ url: string }> {
    throw new Error('Billing is intentionally deferred until the multiplayer beta is stable.');
  }

  async verifyWebhook(): Promise<null> {
    return null;
  }
}

export const billingProvider: BillingProvider = new BillingNotConfiguredProvider();
