export type PaystackReference = string & { readonly __brand: 'PaystackReference' };
export type PaymentState = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
export interface PaymentRequest { orderId: string; orderNumber: string; amountPesewas: number; currency: 'GHS'; customerEmail?: string; idempotencyKey: string; returnUrl: string }
export interface PaymentInitialization { reference: PaystackReference; authorizationUrl: string; accessCode?: string }
export interface PaymentProvider { initialize(request: PaymentRequest): Promise<PaymentInitialization>; verify(reference: PaystackReference): Promise<{ status: PaymentState; amountPesewas: number; currency: string }>; refund(input: { reference: PaystackReference; amountPesewas?: number; reason: string; idempotencyKey: string }): Promise<{ refundReference: string; status: 'pending' | 'processed' | 'failed' }> }
export interface SmsProvider { send(input: { toE164: string; template: string; variables: Record<string,string> }): Promise<{ providerMessageId: string; segmentCount: number }> }
export interface EmailProvider { send(input: { to: string; template: string; variables: Record<string,string> }): Promise<{ providerMessageId: string }> }
export interface GeocodingProvider { search(query: string, countryCode: 'gh'): Promise<Array<{ label: string; latitude: number; longitude: number }>> }
export interface RoutingProvider { estimate(input: { from: { latitude: number; longitude: number }; to: { latitude: number; longitude: number } }): Promise<{ distanceMeters: number; durationSeconds: number }> }
export interface StorageProvider { save(input: { bytes: Uint8Array; contentType: string; filename: string }): Promise<{ relativeUrl: string }> }
export interface ErrorReporter { report(input: { error: unknown; requestId: string; context?: Record<string,unknown> }): void }
