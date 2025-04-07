import { DataSource, Model, Env } from './data_source';

// Note: The specific structure of the API response is still needed internally.

// Define the structure of the API response
interface StripchatApiResponse {
	models: Model[]; // Use the imported Model interface here for consistency
	// Add other top-level fields if needed
}

export class StripchatDataSource extends DataSource {
	private readonly apiUrl = 'https://go.rmhfrtnd.com/app/models-ext/models';

	/**
	 * Fetches the list of models from the Stripchat API.
	 * @param env - The Cloudflare environment object containing secrets.
	 * @returns A promise that resolves to an array of StripchatModel objects.
	 * @throws Error if secrets are missing or the API request fails.
	 */
	async fetchGirls(env: Env): Promise<Model[]> {
		const userId = env.STRIPCHAT_USERID;
		const bearerToken = env.STRIPCHAT_BEARER;

		if (!userId) {
			throw new Error('Stripchat User ID secret (STRIPCHAT_USERID) is not configured.');
		}
		if (!bearerToken) {
			throw new Error('Stripchat Bearer Token secret (STRIPCHAT_BEARER) is not configured.');
		}

		const url = new URL(this.apiUrl);
		url.searchParams.append('userId', userId);

		console.log(`Fetching Stripchat models from: ${url.toString()}`);

		try {
			const response = await fetch(url.toString(), {
				headers: {
					'Authorization': `Bearer ${bearerToken}`,
					'Accept': 'application/json',
				},
				// Consider adding timeout via signal if needed: cf: { connectTimeout: 10000 }
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`Stripchat API request failed with status ${response.status}: ${errorText}`);
				throw new Error(`Stripchat API request failed: ${response.status} ${response.statusText}`);
			}

			const data: StripchatApiResponse = await response.json();

			// Basic validation of the response structure
			if (!data || !Array.isArray(data.models)) {
				console.error('Stripchat API response is missing or has invalid "models" array:', data);
				throw new Error('Invalid response structure from Stripchat API.');
			}

			console.log(`Successfully fetched ${data.models.length} models from Stripchat.`);
			return data.models;

		} catch (error) {
			console.error('Error fetching or parsing Stripchat data:', error);
			// Re-throw the error to be handled by the caller (e.g., the main worker)
			throw error;
		}
	}
}