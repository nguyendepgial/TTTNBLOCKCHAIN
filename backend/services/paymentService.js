// MOCK PAYMENT SERVICE FOR DEMO - BYPASS STRIPE
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const blockchainService = require('./blockchainService');

class PaymentService {
    constructor() {
        // Mock Stripe for demo
        this.stripe = {
            paymentIntents: {
                create: async (data) => ({
                    id: 'pi_mock_' + Date.now(),
                    client_secret: 'cs_mock_' + Date.now(),
                    amount: data.amount,
                    currency: data.currency
                }),
                retrieve: async (id) => ({
                    id: id,
                    status: 'succeeded',
                    amount: 100000 // 1000 VND
                }),
                confirm: async (id) => ({
                    id: id,
                    status: 'succeeded'
                })
            },
            refunds: {
                create: async (data) => ({
                    id: 'rf_mock_' + Date.now(),
                    status: 'succeeded',
                    amount: data.amount
                })
            },
            webhooks: {
                constructEvent: (payload, sig, secret) => ({
                    type: 'payment_intent.succeeded',
                    data: { object: { id: 'pi_mock_webhook' } }
                })
            }
        };
    }

    async createPaymentIntent(orderData) {
        try {
            const { amount, currency = 'usd', orderId, userId, metadata } = orderData;

            // Create payment intent
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: currency,
                metadata: {
                    orderId: orderId.toString(),
                    userId: userId.toString(),
                    ...metadata
                },
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            return {
                success: true,
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                amount: amount,
                currency: currency
            };
        } catch (error) {
            console.error('Error creating payment intent:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async confirmPayment(paymentIntentId, paymentMethodId = null) {
        try {
            let updateData = {};

            if (paymentMethodId) {
                updateData.payment_method = paymentMethodId;
            }

            const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, updateData);

            return {
                success: true,
                status: paymentIntent.status,
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
                metadata: paymentIntent.metadata
            };
        } catch (error) {
            console.error('Error confirming payment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async processPaymentWithBlockchain(orderData, tickets) {
        try {
            const { orderId, userId, totalAmount, userWalletAddress } = orderData;

            // Step 1: Create payment intent
            const paymentResult = await this.createPaymentIntent({
                amount: totalAmount,
                orderId: orderId,
                userId: userId,
                metadata: {
                    type: 'ticket_purchase',
                    ticketCount: tickets.length
                }
            });

            if (!paymentResult.success) {
                throw new Error(`Payment creation failed: ${paymentResult.error}`);
            }

            // In a real implementation, the frontend would handle the payment confirmation
            // For now, we'll simulate successful payment and proceed to mint NFTs

            console.log(`Processing blockchain minting for order ${orderId}`);

            // Step 2: Mint NFTs for each ticket
            const blockchainResults = [];
            for (const ticket of tickets) {
                const metadataURI = `https://api.concerttickets.com/metadata/${ticket.ticket_code}`;

                const mintResult = await blockchainService.mintTicket(
                    userWalletAddress,
                    ticket.id,
                    metadataURI
                );

                blockchainResults.push({
                    ticketId: ticket.id,
                    ticketCode: ticket.ticket_code,
                    blockchainResult: mintResult
                });

                if (!mintResult.success) {
                    console.error(`Failed to mint NFT for ticket ${ticket.id}:`, mintResult.error);
                    // In production, you might want to rollback or handle partial failures
                }
            }

            return {
                success: true,
                paymentIntentId: paymentResult.paymentIntentId,
                clientSecret: paymentResult.clientSecret,
                blockchainResults: blockchainResults,
                totalMinted: blockchainResults.filter(r => r.blockchainResult.success).length,
                totalFailed: blockchainResults.filter(r => !r.blockchainResult.success).length
            };

        } catch (error) {
            console.error('Error processing payment with blockchain:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async refundPayment(paymentIntentId, amount = null, reason = 'requested_by_customer') {
        try {
            const refundData = {
                payment_intent: paymentIntentId,
                reason: reason
            };

            if (amount) {
                refundData.amount = Math.round(amount * 100);
            }

            const refund = await this.stripe.refunds.create(refundData);

            return {
                success: true,
                refundId: refund.id,
                amount: refund.amount / 100,
                currency: refund.currency,
                status: refund.status,
                reason: refund.reason
            };
        } catch (error) {
            console.error('Error processing refund:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getPaymentStatus(paymentIntentId) {
        try {
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

            return {
                success: true,
                status: paymentIntent.status,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
                metadata: paymentIntent.metadata,
                lastPaymentError: paymentIntent.last_payment_error
            };
        } catch (error) {
            console.error('Error getting payment status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Webhook handler for Stripe events
    async handleWebhook(rawBody, signature) {
        try {
            const event = this.stripe.webhooks.constructEvent(
                rawBody,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET
            );

            console.log(`Received Stripe webhook: ${event.type}`);

            switch (event.type) {
                case 'payment_intent.succeeded':
                    const paymentIntent = event.data.object;
                    console.log(`Payment succeeded: ${paymentIntent.id}`);
                    // Handle successful payment - could trigger blockchain minting here
                    break;

                case 'payment_intent.payment_failed':
                    console.log(`Payment failed: ${event.data.object.id}`);
                    // Handle failed payment
                    break;

                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }

            return { success: true, eventType: event.type };
        } catch (error) {
            console.error('Error handling webhook:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new PaymentService();