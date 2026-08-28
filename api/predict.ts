import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import type { VercelRequest, VercelResponse } from "@vercel/node"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'), // Limit 5 per minute
  analytics: true,
})

export const config = {
  runtime: 'nodejs',
};
// Allow up to 40s for the Modal call before Vercel cuts off the function
export const maxDuration = 40;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ?? "127.0.0.1";

  const { success, limit, remaining, reset } = await ratelimit.limit(ip);
  if (!success) {
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', reset.toString());
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  try {
    // 2. Parse the text arriving from your React frontend
    const { text } = req.body ?? {};

    if (!text) {
      return res.status(400).json({ error: 'Text input is required' });
    }

    // 3. Grab credentials securely from your Vercel Environment Variables
    const MODAL_URL = process.env.MODAL_ENDPOINT_URL;
    const MODAL_API_KEY = process.env.API_KEY;

    if (!MODAL_URL || !MODAL_API_KEY) {
      return res.status(500).json({ error: 'Modal credentials are not properly configured' });
    }

    console.log(`Forwarding text to Modal: ${text}`);

    // 4. Forward the payload to Modal
    const modalResponse = await fetch(MODAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MODAL_API_KEY}`
      },
      body: JSON.stringify({ text: text }),
    });

    console.log(`Received response from Modal with status: ${modalResponse.status}`);

    if (!modalResponse.ok) {
      throw new Error(`Modal API responded with status ${modalResponse.status}`);
    }

    const predictionData = await modalResponse.json();

    // 5. Send the BERT prediction back to the React client
    return res.status(200).json(predictionData);

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}