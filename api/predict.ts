export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 2. Parse the text arriving from your React frontend
    const { text } = await req.json();
    
    if (!text) {
      return new Response(JSON.stringify({ error: 'Text input is required' }), { status: 400 });
    }

    // 3. Grab credentials securely from your Vercel Environment Variables
    const MODAL_URL = process.env.MODAL_ENDPOINT_URL; 
    const MODAL_API_KEY = process.env.API_KEY;

    if (!MODAL_URL || !MODAL_API_KEY) {
      return new Response(JSON.stringify({ error: 'Modal credentials are not properly configured' }), { status: 500 });
    }

    // 4. Forward the payload to Modal
    const modalResponse = await fetch(MODAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MODAL_API_KEY}` 
      },
      body: JSON.stringify({ text: text }),
    });

    if (!modalResponse.ok) {
      throw new Error(`Modal API responded with status ${modalResponse.status}`);
    }

    const predictionData = await modalResponse.json();

    // 5. Send the BERT prediction back to the React client
    return new Response(JSON.stringify(predictionData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}