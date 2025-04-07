# Camgirl Interactive Map - Plan

## 1. Goals

*   **Core:** Create an interactive, visually appealing world map showing the approximate geographic distribution of online camgirls.
*   **Interactive:** Allow users to zoom, pan, and hover over countries to view camgirl counts and (potentially anonymized/aggregated) details.
*   **Scalable:** Build a foundation that can easily accommodate new data sources and features in the future.
*   **Engaging:** Present the data in a fun and interesting way, encouraging user interaction and exploration.

## 2. Architecture

The application will follow a simple architecture leveraging a Cloudflare Worker:

*   **Frontend:** Static HTML, CSS, and JavaScript files for the interactive map interface. Leaflet.js is a good open source interactive map library.
*   **Backend:** Cloudflare Worker handling data fetching, processing, and API endpoint creation.
*   **Data Source Abstraction:**  A middle layer will sit between the worker and the Stripchat API (and any future APIs). This layer will be responsible for fetching, sanitizing, and aggregating the data before it gets exposed to the worker.

**Simplified flow:**

1.  User accesses the website.
2.  Cloudflare Worker serves static frontend assets.
3.  Frontend JavaScript requests data from the Cloudflare Worker's API endpoint.
4.  Cloudflare Worker fetches data via the data abstraction layer (initially Stripchat API).
5.  Data abstraction layer sanitizes and aggregates girl/country data.
6.  Worker serves the processed data to the frontend.
7.  Frontend renders the interactive map.

## 3. Technology

*   **Frontend:** HTML, CSS, JavaScript (TypeScript preferred). Consider using a lightweight mapping library like Leaflet.js or similar.
*   **Backend:** Cloudflare Worker (JavaScript/TypeScript).
*   **Data Fetching:** `node-fetch` or equivalent for API requests.
*   **Secrets Management:** Cloudflare Secrets for securely storing the Stripchat API keys.
*   **Data processing:** `lodash` or equivalent is a good JS library for data manipulation.

## 4. Next Steps

These steps are broken down into granular tasks that should be easy for a junior programmer to follow.

*   **A. Project Setup and Initial Infrastructure**
    *   [x] A1. Create a new directory called `backend` at the root level.
    *   [x] A2. Move the current worker code at `camgirl-interactive-map` into `backend`. So, we have `<projectroot>/backend/` with files like `wrangler.jsonc`
    *   [x] A3. Create a new directory called `frontend` at the root level.
    *   [x] A4. Copy over the `public/` directory at `<projectroot>/backend/camgirl-interactive-map` into `<projectroot>/frontend/`. Delete everything else.
    *   [x] A5. Update the `ROUTES` configuration at `<projectroot>/backend/wrangler.jsonc` such that it serves static contents at `frontend/public/`. (cloudflare workers documentation)
*   **B. Data Abstraction Layer**
    *   [x] B1. Create a new file at `<projectroot>/backend/src/data_sources/stripchat.ts` (or .js, depending on your preferred choice of Typescript or Javascript).
    *   [x] B2. Create a new class `StripchatDataSource` inside the file.
    *   [x] B3. Implement a method `fetchGirls()` which connects to the Stripchat API, gets the raw girl data, sanitizes it, and returns it. (node-fetch docs, JSON parsing). Remember to use Cloudflare secrets for credentials.
    *   [x] B4. Create a new abstract class file at `<projectroot>/backend/src/data_sources/data_source.ts`. It should have an abstract function that must be defined by all data source classes.
    *   [x] B5. Let `StripchatDataSource` extend the base class `DataSource`.
    *   [x] B6. Create an aggregator class file at `<projectroot>/backend/src/aggregator.ts` and have it provide data after getting them from the data source classes.
*   **C. Cloudflare Worker Implementation**
    *   [x] C1. Set up the Cloudflare secrets for the Stripchat API keys via the Cloudflare dashboard. (Cloudflare secrets documentation).
    *   [x] C2. Modify the main worker script at `<projectroot>/backend/src/index.ts` to:
        *   [x] Use the `StripchatDataSource` class to fetch the camgirl data.
        *   [x] Aggregate data to count camgirls per country.
        *   [x] Return the aggregated data as JSON from the API endpoint at `/api/girls`.
        *   [x] Handle errors gracefully and return appropriate HTTP status codes.
    *   [x] C3. Add CORS headers so that you can make API calls from localhost.
*   **D. Frontend Integration**
    *   [x] D1. Choose a mapping library (e.g., Leaflet.js) and integrate it into the frontend.
    *   [x] D2. Fetch the JSON data from the Cloudflare Worker's API endpoint.
    *   [x] D3. Render the map with country shading based on camgirl counts.
    *   [x] D4. Implement basic interactivity (zoom, pan, hover).
*   **E. Initial Deployment**
    *   E1. Deploy the Cloudflare Worker and frontend using `npm run deploy`.
    *   E2. Test the website and API endpoint thoroughly.

## 5. Considerations

*   **Data Privacy:** Be mindful of data privacy and anonymity. Only display aggregated data or anonymized profiles. Do *not* expose sensitive user information.
*   **Rate Limiting:** Implement proper error handling and rate limiting to prevent abuse of the Stripchat API.
*   **Error Handling:** Implement comprehensive error handling and logging throughout the application.
*   **Reference material:** Refer to the file reference.md for an example of a workping Python implemention of the core concepts.