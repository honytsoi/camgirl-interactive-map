// Define the expected structure for environment variables/secrets
// This should ideally be consistent with worker-configuration.d.ts
// and include any secrets needed by *any* data source.
export interface Env {
	// Example secrets (add specific ones as needed)
	STRIPCHAT_USERID?: string;
	STRIPCHAT_BEARER?: string;
	// Other bindings
	ASSETS: Fetcher;
	[key: string]: any; // Allow other potential bindings/vars
}

// Define a generic structure for a model from any data source
// Specific sources can extend or implement this.
export interface Model {
	modelsCountry?: string; // Common field needed for aggregation
	// Add other common fields if applicable
	[key: string]: any; // Allow other properties
}

/**
 * Abstract base class for all data sources.
 * Defines the contract for fetching model data.
 */
export abstract class DataSource {
	/**
	 * Abstract method to fetch model data from the specific source.
	 * Implementations should handle API requests, authentication, and basic parsing.
	 * @param env - The Cloudflare environment object containing secrets and bindings.
	 * @returns A promise that resolves to an array of Model objects.
	 * @throws Error if fetching or parsing fails.
	 */
	abstract fetchGirls(env: Env): Promise<Model[]>;
}