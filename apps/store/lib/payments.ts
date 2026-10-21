export interface CheckoutInput {
  amount: number;          // minor units (halalas)
  currency: string;
  description: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface CheckoutResult {
  provider: 'moyasar' | 'mock';
  providerRef: string;     // invoice id
  paymentUrl: string;      // hosted payment page URL
}

export interface PaymentProvider {
  name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyPayment(providerRef: string): Promise<{ paid: boolean; amount: number; currency: string; metadata: Record<string, string> }>;
}

class MockProvider implements PaymentProvider {
  name = 'mock';
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const ref = 'mock_' + Math.random().toString(36).slice(2);
    const url = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3002'}/mock-pay?ref=${ref}&order=${input.metadata.order_id ?? ''}`;
    return { provider: 'mock', providerRef: ref, paymentUrl: url };
  }
  async verifyPayment(ref: string) {
    return { paid: true, amount: 0, currency: 'SAR', metadata: { order_id: ref } };
  }
}

class MoyasarProvider implements PaymentProvider {
  name = 'moyasar';
  private secret = process.env.MOYASAR_SECRET_KEY!;
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const res = await fetch('https://api.moyasar.com/v1/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + Buffer.from(this.secret + ':').toString('base64') },
      body: JSON.stringify({
        amount: input.amount, currency: input.currency, description: input.description,
        callback_url: input.callbackUrl, metadata: input.metadata,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Moyasar checkout failed: ${res.status} ${err}`);
    }
    const data: any = await res.json();
    return { provider: 'moyasar', providerRef: data.id, paymentUrl: data.url };
  }
  async verifyPayment(ref: string) {
    const res = await fetch(`https://api.moyasar.com/v1/invoices/${ref}`, {
      headers: { 'Authorization': 'Basic ' + Buffer.from(this.secret + ':').toString('base64') },
    });
    if (!res.ok) throw new Error(`Moyasar verify failed: ${res.status}`);
    const data: any = await res.json();
    return { paid: data.status === 'paid', amount: data.amount, currency: data.currency, metadata: data.metadata ?? {} };
  }
}

export function getPaymentProvider(): PaymentProvider {
  const mode = (process.env.PAYMENTS_MODE ?? '').toLowerCase();
  if (mode === 'mock' || !process.env.MOYASAR_SECRET_KEY) return new MockProvider();
  return new MoyasarProvider();
}
