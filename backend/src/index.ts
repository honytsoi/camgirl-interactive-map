import { StripchatDataSource } from './data_sources/stripchat';
import { Aggregator } from './aggregator';
import { Env } from './data_sources/data_source'; // Import shared Env

// Define CORS headers - adjust origin in production if needed
const corsHeaders = {
	'Access-Control-Allow-Origin': '*', // Allows all origins for development
	'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Add others if needed
	'Access-Control-Max-Age': '86400', // Cache preflight response for 1 day
};

// Helper to add CORS headers to a Response
function addCorsHeaders(response: Response): Response {
	Object.entries(corsHeaders).forEach(([key, value]) => {
		response.headers.set(key, value);
	});
	return response;
}

// Instantiate data sources and aggregator (outside the handler for reuse)
const stripchatDataSource = new StripchatDataSource();
const aggregator = new Aggregator([stripchatDataSource]); // Pass sources in an array

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle CORS preflight requests (OPTIONS)
		if (request.method === 'OPTIONS') {
			// Handle preflight requests for any path or be more specific if needed
			return addCorsHeaders(new Response(null, { status: 204 })); // No Content
		}

		// Handle API requests
		if (url.pathname === '/api/girls' && request.method === 'GET') {
			try {
				console.log('API request received for /api/girls');
				const aggregatedData = await aggregator.getAggregatedData(env);
				const jsonResponse = JSON.stringify(aggregatedData, null, 2); // Pretty print JSON

				return addCorsHeaders(
					new Response(jsonResponse, {
						headers: { 'Content-Type': 'application/json' },
						status: 200,
					})
				);
			} catch (error: any) {
				console.error('Error in /api/girls endpoint:', error);
				const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
				// Return error details only in development? For now, return a generic message.
				const errorResponse = JSON.stringify({ error: 'Failed to fetch or aggregate data.', details: errorMessage });

				return addCorsHeaders(
					new Response(errorResponse, {
						headers: { 'Content-Type': 'application/json' },
						status: 500, // Internal Server Error
					})
				);
			}
		}

		// Fallback to serving static assets for all other requests
		try {
			// Ensure ASSETS binding exists before calling fetch
			if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
				return await env.ASSETS.fetch(request);
			} else {
				console.error('ASSETS binding is not configured or invalid.');
				return addCorsHeaders(new Response('Static asset serving is not configured.', { status: 500 }));
			}
		} catch (e) {
			// Catch potential errors from env.ASSETS.fetch (e.g., asset not found)
			// Typically, wrangler handles 404s for assets automatically, but good to have a catch-all.
			console.error('Error serving static asset:', e);
			return addCorsHeaders(new Response('Not found', { status: 404 }));
		}
	},
} satisfies ExportedHandler<Env>;
