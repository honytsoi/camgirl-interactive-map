# Camgirl Interactive Map

This project creates an interactive world map showing the approximate geographic distribution of online camgirls from Stripchat. It allows users to zoom, pan, and hover over countries to view camgirl counts.

## Features
- Interactive map using Leaflet.js
- Data fetched from Stripchat API via a Cloudflare Worker
- Country shading based on camgirl counts
- Hover tooltips with country names and model counts

## Running Locally
1. Clone the repository: `git clone https://github.com/honytsoi/camgirl-interactive-map.git`
2. Navigate to the project directory: `cd camgirl-interactive-map`
3. Set up the backend:
   - `cd backend`
   - Install dependencies: `npm install`
   - Create a `.dev.vars` file with your Stripchat API credentials:
     ```
     STRIPCHAT_USERID="your_user_id_here"
     STRIPCHAT_BEARER="your_bearer_token_here"
     ```
   - Start the local development server: `npm run dev`
4. Open a browser and navigate to `http://localhost:8787` to view the application.

## Deployment
This project is deployed using Cloudflare Workers. For deployment instructions, refer to the Cloudflare documentation.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.
