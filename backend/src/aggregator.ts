import { DataSource, Model, Env } from './data_sources/data_source';

// Define the structure for the aggregated data (e.g., count per country)
export interface AggregatedData {
	[countryCode: string]: number;
}

/**
 * Aggregates data from multiple data sources.
 */
export class Aggregator {
	private dataSources: DataSource[];

	/**
	 * Creates an instance of the Aggregator.
	 * @param dataSources - An array of DataSource instances to fetch data from.
	 */
	constructor(dataSources: DataSource[]) {
		if (!dataSources || dataSources.length === 0) {
			throw new Error('Aggregator requires at least one DataSource.');
		}
		this.dataSources = dataSources;
	}

	/**
	 * Fetches data from all configured sources and aggregates it.
	 * Currently aggregates by counting models per country code.
	 * @param env - The Cloudflare environment object.
	 * @returns A promise that resolves to the aggregated data.
	 */
	async getAggregatedData(env: Env): Promise<AggregatedData> {
		console.log(`Aggregating data from ${this.dataSources.length} source(s)...`);

		// Fetch data from all sources concurrently
		const fetchPromises = this.dataSources.map(source =>
			source.fetchGirls(env).catch(error => {
				// Log error for the specific source but don't fail the whole aggregation
				// Return an empty array for this source on error
				console.error(`Error fetching data from ${source.constructor.name}:`, error);
				return [] as Model[];
			})
		);

		const results = await Promise.all(fetchPromises);
		const allModels = results.flat(); // Combine models from all sources

		console.log(`Total models fetched across all sources: ${allModels.length}`);

		// Aggregate by counting models per country
		const counts: AggregatedData = {};
		for (const model of allModels) {
			// Ensure country code is a valid 2-letter string (case-insensitive check, store uppercase)
			const countryCode = model.modelsCountry?.trim().toUpperCase();
			if (countryCode && countryCode.length === 2 && /^[A-Z]{2}$/.test(countryCode)) {
				counts[countryCode] = (counts[countryCode] || 0) + 1;
			} else if (model.modelsCountry) {
				// Log if a country code exists but is invalid
				// console.warn(`Invalid or missing country code found: '${model.modelsCountry}'`);
			}
		}

		const uniqueCountries = Object.keys(counts).length;
		console.log(`Aggregation complete. Found models in ${uniqueCountries} unique countries.`);

		return counts;
	}
}