## Reference material

This is an example of a python script that performs the same basic task, creating a camgirl map, but as a snapshot with no interaction.

Use it as a reference to know how the stripchat API works and also the logic for identify and country girls per country.

``` python
# Filename: stripchat_model_map_simplified.py

# This script generates a heatmap of Online Camgirls by country using data
# from a JSON file and displays it on a world map.  It also saves the JSON data.

import os
import datetime
import json
from collections import Counter
import pandas as pd
import geopandas as gpd
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import urllib.request
import urllib.error
from shapely.geometry import Point # Used for representative_point

from dotenv import load_dotenv
import requests


# --- Configuration ---
JSON_FILE_PATH = "stripchat_api/models.json"  # Input data file
# OUTPUT_MAP_FILENAME = "infographic_models_by_country_simplified_adjusted.png" # Output map image (updated name)
SHAPEFILE_URL = "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip" # Source for map geometry
CACHE_DIR = "shapefile_cache"              # Directory to store downloaded shapefile
TOP_N_COUNTRIES_TO_ANNOTATE = 11            # How many top countries to label on the map
ANNOTATION_OFFSET_POINTS = (15, 15)        # Default pixel offset (x, y) for annotation text

# --- NEW: Configuration for Specific Annotation Overrides ---
# Keys are the *display names* of countries (after shortening, if any)
# Values are dictionaries with parameters to override for ax.annotate
# Common overrides: 'xytext': (x, y) offset in points, 'ha': horizontal alignment, 'va': vertical alignment
ANNOTATION_OVERRIDES = {
    'Colombia': {
        'xytext': (-40, -20), # Move significantly left and slightly down
        'ha': 'right',       # Align text to the right of the offset point
        # Optional: Adjust arrow curve if needed
        # 'arrowprops': {'connectionstyle': "arc3,rad=-0.3"}
    },
    'Venezuela': {
        'xytext': (40, 10),  # Move significantly right and slightly up
        'ha': 'left',        # Align text to the left of the offset point
        # Optional: Adjust arrow curve
        # 'arrowprops': {'connectionstyle': "arc3,rad=0.3"}
    },
    'Romania': {
        # move down and slightly left
        'xytext': (-20, -30),
    # --- Add more overrides here if needed for other countries ---
    # 'ExampleCountry': {'xytext': (0, 30), 'va': 'bottom'},
    },
        'Philippines': {
        # move down and slightly right
        'xytext': (40, -10),
 
    },
    'Mexico': {
        # move to the left
        'xytext': (-30, 0),
    },
    'South Africa': {
        # move down
        'xytext': (0, -40),
    }
    # --- Add more overrides here if needed for other countries ---
    # 'ExampleCountry': {'xytext': (0, 30), 'va': 'bottom'},
    
}


# --- Map Styling ---
FIG_WIDTH = 14                             # Width of the output figure in inches
FIG_HEIGHT = 8                             # Height of the output figure in inches
BG_COLOR = '#f0f4f7'                       # Background color of the map figure (light blue-grey)
MISSING_COLOR = '#d0d0d0'                   # Color for countries with no data (grey) - Should be light now, update if needed '#ffffff' might be better
BORDER_COLOR = '#aaaaaa'                   # Color for country borders (lighter grey)
ANNOTATION_COLOR = '#1a1a1a'               # Color for annotation text (dark grey)
ANNOTATION_BG = '#ffffffaa'               # Background color for annotation text box (semi-transparent white)
TITLE_FONTSIZE = 16
SUBTITLE_FONTSIZE = 11
ANNOTATION_FONTSIZE = 8

# --- Helper Functions ---

def create_visual_log_colormap(name='visual_log_cmap'):
    """
    Creates a custom Matplotlib colormap that visually spaces colors
    similar to a logarithmic scale, emphasizing differences at the lower end.
    Useful when data spans several orders of magnitude.
    """
    # Colors from white -> light yellow -> orange -> dark orange/brown
    colors = [
        (0.0,  '#ffffec'),   # Very light yellow/off-white (start slightly darker than pure white)
        (0.05, '#ffffd4'),  # Very light yellow
        (0.15, '#fed98e'),  # Light yellow-orange
        (0.3,  '#fe9929'),  # Yellow-orange
        (0.5,  '#d95f0e'),  # Orange
        (0.7,  '#cc4c02'),  # Darker orange
        (1.0,  '#8c2d04')   # Dark orange/brownish-red (Adjusted for better contrast)
    ]
    # Create an explicit boundary norm based on data range (or approximate)
    # Let's use fixed bounds for demonstration, assuming max count around 1200+
    # bounds = [0, 1, 10, 50, 100, 250, 500, 1300] # Example bounds
    # norm = mcolors.BoundaryNorm(bounds, len(bounds) - 1)
    # cmap = mcolors.LinearSegmentedColormap.from_list(name, colors, N=len(bounds)-1)

    # Simpler Linear Segmented Colormap approach (as before, visually log-ish)
    cmap = mcolors.LinearSegmentedColormap.from_list(name, colors)
    return cmap


def ensure_cache_dir(dir_path):
    """Creates the cache directory if it doesn't exist."""
    try:
        os.makedirs(dir_path, exist_ok=True)
    except OSError as e:
        print(f"Error: Could not create cache directory '{dir_path}': {e}")
        exit(1)

def download_shapefile(url, local_path):
    """Downloads the shapefile zip if it's not found locally."""
    if not os.path.exists(local_path):
        print(f"Shapefile not found locally. Downloading from {url}...")
        try:
            with urllib.request.urlopen(url) as response, open(local_path, 'wb') as out_file:
                if response.status != 200:
                    raise urllib.error.URLError(f"Download failed. Server status: {response.status}")
                data = response.read()
                out_file.write(data)
            print("Shapefile download complete.")
        except (urllib.error.URLError, IOError, Exception) as e:
            print(f"Error downloading or saving shapefile: {e}")
            if os.path.exists(local_path):
                try: os.remove(local_path)
                except OSError as rm_err: print(f"Warning: Could not remove incomplete download '{local_path}': {rm_err}")
            exit(1)

def load_shapefile(zip_path):
    """Loads the world shapefile from a local zip archive using GeoPandas."""
    geopandas_read_path = f"zip://{zip_path}"
    try:
        print(f"Reading shapefile using geopandas from: {geopandas_read_path}")
        world = gpd.read_file(geopandas_read_path)
        print("Shapefile loaded successfully.")

        pop_col = next((col for col in ['pop_est', 'POP_EST'] if col in world.columns), None)
        admin_col = next((col for col in ['ADMIN', 'admin', 'NAME', 'name'] if col in world.columns), None)

        if admin_col:
            print(f"Filtering out Antarctica using column '{admin_col}'...")
            original_rows = len(world)
            world = world[world[admin_col] != 'Antarctica']
            if pop_col: # Also filter zero population if possible
                 world = world[world[pop_col] > 0]
            rows_filtered = original_rows - len(world)
            print(f"Filtered {rows_filtered} rows (Antarctica/zero population).")
        else:
             print(f"Warning: Could not find standard admin/name column for filtering. Columns found: {world.columns.tolist()}")

        world['geometry'] = world.geometry.buffer(0)
        return world

    except Exception as e:
        print(f"Error reading shapefile with geopandas from '{geopandas_read_path}': {e}")
        print(f"The cached file at '{zip_path}' might be corrupted.")
        print("Try deleting the file or the entire cache directory and run again.")
        exit(1)

def find_iso_a2_column(df):
    """Attempts to find the column containing ISO A2 country codes."""
    potential_cols = ['ISO_A2', 'iso_a2', 'ADM0_A2', 'sov_a2', 'ISO_A2_EH', 'ISO_A2_']
    for col in potential_cols:
        if col in df.columns:
            print(f"Found ISO A2 country code column: '{col}'")
            return col
    if ' sovereignt' in df.columns and df[' sovereignt'].astype(str).str.match(r'^[A-Z]{2}$').any():
         print(f"Found potential ISO A2 codes in column: ' sovereignt'")
         return ' sovereignt'
    print(f"Error: Could not find a suitable ISO A2 country code column. Available columns: {df.columns.tolist()}")
    exit(1)

import os
import requests
from dotenv import load_dotenv
import json # Import json for potential JSONDecodeError handling

def load_models():
    """
    Fetches the models data from the Stripchat API endpoint.

    Reads credentials (USER ID and Bearer token) from environment variables.

    Returns:
        dict or list: The parsed JSON data from the API response if successful.
        None: If credentials are not found or if an error occurs during the request.

    Raises:
        requests.exceptions.HTTPError: If the server returns a 4xx or 5xx status code.
        requests.exceptions.RequestException: For other network-related issues (timeout, connection error).
    """
    BASE = "https://go.rmhfrtnd.com"
    MODELS_ENDPOINT = "/app/models-ext/models" # More descriptive name
    
    # Load environment variables from .env file
    load_dotenv() 
    
    stripchat_userid = os.getenv("stripchat_userid")
    stripchat_bearer =  os.getenv("stripchat_bearer")

    # --- Input Validation ---
    if not stripchat_userid:
        print("Error: 'stripchat_userid' not found in environment variables.")
        return None
    if not stripchat_bearer:
        print("Error: 'stripchat_bearer' not found in environment variables.")
        return None

    # Construct the full URL
    url = BASE + MODELS_ENDPOINT
    
    # Prepare headers with the Bearer token
    headers = {
        'Authorization': f'Bearer {stripchat_bearer}',
        'Accept': 'application/json' # Good practice to specify accepted content type
    }
    
    # Prepare parameters (userId goes here)
    params = {
        'userId': stripchat_userid
    }
    
    print(f"Attempting to fetch models from: {url} with userId: {stripchat_userid}")

    try:
        # Make the GET request with headers and parameters
        response = requests.get(url, headers=headers, params=params, timeout=30) # Added timeout

        # Check if the request was successful (status code 2xx)
        # Raise an HTTPError for bad status codes (4xx or 5xx)
        response.raise_for_status() 

        # Parse the JSON response
        data = response.json()
        print(f"Successfully fetched and parsed data for {len(data.get('models', []))} models.") # Example: access nested data safely
        return data

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
        print(f"Status Code: {response.status_code}")
        print(f"Response Text: {response.text[:500]}...") # Show beginning of response text for debugging
        return None
    except requests.exceptions.ConnectionError as conn_err:
        print(f"Connection error occurred: {conn_err}")
        return None
    except requests.exceptions.Timeout as timeout_err:
        print(f"Timeout error occurred: {timeout_err}")
        return None
    except requests.exceptions.RequestException as req_err:
        print(f"An ambiguous request error occurred: {req_err}")
        return None
    except json.JSONDecodeError as json_err:
        # Handle cases where the response isn't valid JSON, even with a 2xx status
        print(f"Failed to decode JSON response: {json_err}")
        print(f"Response Text: {response.text[:500]}...") 
        return None

    
# --- Main Script Logic ---

# optional argument for output filename
def main(output_filename="stripchat_model_map.png", timestampfilename=False):
    # 1. Load Model Data from json if it exists, or from live url if it doesn't
    print("--- 1. Loading Model Data ---")
    try:
        with open(JSON_FILE_PATH, "r", encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: JSON file not found at '{JSON_FILE_PATH}'")
        data = load_models()
        # exit(1)
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{JSON_FILE_PATH}'.")
        exit(1)
    except Exception as e:
        print(f"An unexpected error occurred loading JSON: {e}")
        exit(1)

    # Save the JSON data
    print("\n--- Saving JSON Data ---")
    try:
        json_filename = "models_data.json"  # Default JSON filename
        if timestampfilename:
            json_filename = f"{datetime.datetime.now().strftime('%Y%m%d_%H%M')}_models_data.json"
        
        json_filepath = os.path.join(os.getcwd(), json_filename) # Save in current working directory
        
        with open(json_filepath, "w", encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)  # Save with indentation
        print(f"JSON data saved to '{json_filepath}'")
    except Exception as e:
        print(f"Error saving JSON data: {e}")



    # 2. Process Model Data
    print("\n--- 2. Processing Model Data ---")
    country_codes = []
    models_data = data.get("models", [])
    if not isinstance(models_data, list):
        print(f"Warning: 'models' key is not a list. Found {type(models_data)}. Treating as empty.")
        models_data = []

    valid_codes_found = 0
    if not models_data:
        print("Warning: No models found in JSON data.")
    else:
        print(f"Processing {len(models_data)} model entries...")
        for model in models_data:
            if isinstance(model, dict):
                country_code = model.get("modelsCountry")
                if isinstance(country_code, str) and len(country_code.strip()) == 2:
                    country_codes.append(country_code.strip().upper())
                    valid_codes_found += 1 # Increment counter for subtitle

    if not country_codes:
        print("Warning: No valid 2-letter country codes found. Map will lack density data.")
        country_counts = Counter()
    else:
        country_counts = Counter(country_codes)
        print(f"Found models across {len(country_counts)} unique countries/regions.")

    counts_series = pd.Series(country_counts, name='model_count')
    counts_df = counts_series.reset_index()
    counts_df.columns = ['iso_a2_from_data', 'model_count']

    # 3. Prepare World Map Data
    print("\n--- 3. Preparing World Map Geometry ---")
    shapefile_basename = os.path.basename(SHAPEFILE_URL)
    local_zip_path = os.path.join(CACHE_DIR, shapefile_basename)
    ensure_cache_dir(CACHE_DIR)
    download_shapefile(SHAPEFILE_URL, local_zip_path)
    world = load_shapefile(local_zip_path)
    world_iso_col = find_iso_a2_column(world)
    world[world_iso_col] = world[world_iso_col].astype(str).str.upper()
    counts_df['iso_a2_from_data'] = counts_df['iso_a2_from_data'].astype(str).str.upper()

    # 4. Merge Data
    print("\n--- 4. Merging Model Counts with Map Data ---")
    world_merged = world.merge(
        counts_df,
        left_on=world_iso_col,
        right_on='iso_a2_from_data',
        how='left'
    )
    world_merged['model_count'] = world_merged['model_count'].fillna(0).astype(int)
    print(f"Merge complete. Total map features: {len(world_merged)}")
    print(f"Countries with model count > 0: {len(world_merged[world_merged['model_count'] > 0])}")

    # 5. Create Plot
    print("\n--- 5. Generating Infographic Map ---")
    visual_log_cmap = create_visual_log_colormap()
    fig, ax = plt.subplots(1, 1, figsize=(FIG_WIDTH, FIG_HEIGHT))
    fig.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)

    # Define vmin and vmax for the color scale based on actual data
    # Add 1 to min/max for log-like scaling if using BoundaryNorm or LogNorm later
    # For LinearSegmentedColormap, it maps 0 to max count across the gradient
    min_count = 1 # Start color scale from 1 to distinguish from 0/missing
    max_count = world_merged['model_count'].max()
    # If max_count is 0, set it to 1 to avoid division by zero or empty range issues
    if max_count == 0:
        max_count = 1
        print("Warning: Maximum model count is 0. Color scale may not be informative.")

    world_merged.plot(
        column='model_count',
        cmap=visual_log_cmap,
        linewidth=0.5,
        ax=ax,
        edgecolor=BORDER_COLOR,
        legend=True,
        legend_kwds={
            'label': "Approx. Number of Camgirls by Country",
            'orientation': "horizontal",
            'shrink': 0.6,
            'pad': 0.02,
            'location': 'bottom',
            'format': '%.0f',
            'aspect': 35
        },
        missing_kwds={
            "color": '#ffffff', # Use white for missing/zero, makes non-zero stand out more
            "edgecolor": BORDER_COLOR,
            "label": "No data / 0 models", # Updated label might not always show depending on `plot` implementation
        },
        # Set vmin/vmax to control the color mapping range explicitly
        # Map counts from 1 up to the maximum onto the colormap
        # Countries with 0 will use the missing_kwds color
        vmin=min_count,
        vmax=max_count,
        # Note: LinearSegmentedColormap doesn't strictly need vmin/vmax if data starts near 0,
        # but it helps ensure consistency if data changes.
        # For true log scaling, use norm=mcolors.LogNorm(vmin=min_count, vmax=max_count)
        # or norm=mcolors.PowerNorm(gamma=0.5, vmin=min_count, vmax=max_count)
    )

    # Adjust the color of countries with 0 count to match missing_kwds if needed
    # (This step is sometimes necessary if `plot` doesn't handle 0 with missing_kwds perfectly)
    zero_count_patches = [patch for patch, count in zip(ax.patches, world_merged['model_count']) if count == 0]
    for patch in zero_count_patches:
        patch.set_facecolor('#ffffff') # Explicitly set 0 count to white


    # --- Add Annotations for Top N Countries (with Overrides) ---
    name_col = next((col for col in ['NAME', 'name', 'ADMIN', 'admin'] if col in world_merged.columns), None)

    if name_col and TOP_N_COUNTRIES_TO_ANNOTATE > 0:
        top_countries = world_merged[world_merged['model_count'] > 0].nlargest(TOP_N_COUNTRIES_TO_ANNOTATE, 'model_count')
        print(f"\n--- Annotating Top {len(top_countries)} Countries (Applying Overrides) ---")

        top_countries['repr_point'] = top_countries.geometry.representative_point()
        country_name_replacements = {'United States of America': 'USA', 'Russian Federation': 'Russia'}

        for idx, row in top_countries.iterrows():
            # Determine the display name (apply replacements)
            display_name = country_name_replacements.get(row[name_col], row[name_col])
            count = row['model_count']
            point = row['repr_point']
            x, y = point.x, point.y

            # --- Apply Overrides ---
            # Start with default parameters
            current_offset = ANNOTATION_OFFSET_POINTS
            current_ha = 'center'
            current_va = 'bottom'
            # Make a copy of the default arrowprops to modify safely
            current_arrowprops = dict(
                    arrowstyle="->",
                    color=ANNOTATION_COLOR,
                    connectionstyle="arc3,rad=0.2", # Default curve
                    linewidth=0.6
                )

            # Check if this country has overrides defined
            if display_name in ANNOTATION_OVERRIDES:
                print(f"  - Applying custom annotation for {display_name}")
                overrides = ANNOTATION_OVERRIDES[display_name]
                # Get overridden values, falling back to defaults if not specified
                current_offset = overrides.get('xytext', current_offset)
                current_ha = overrides.get('ha', current_ha)
                current_va = overrides.get('va', current_va)
                # Check if arrowprops or specific parts like connectionstyle need overriding
                if 'arrowprops' in overrides:
                    # If full arrowprops dict is provided, use it (careful, replaces all defaults)
                    # current_arrowprops = overrides['arrowprops']
                    # More likely: Update specific keys within default arrowprops
                    custom_arrow_settings = overrides['arrowprops']
                    current_arrowprops.update(custom_arrow_settings) # Update default props with specific ones
                # Allow overriding just connectionstyle directly if preferred
                if 'connectionstyle' in overrides:
                    current_arrowprops['connectionstyle'] = overrides['connectionstyle']

            print(f"  - Annotating: {display_name} (~{count}) at ({x:.2f}, {y:.2f}) with offset {current_offset}, ha={current_ha}")

            # Add the annotation using the determined parameters
            ax.annotate(
                text=f"{display_name}\n~{count}",
                xy=(x, y),
                xytext=current_offset,
                textcoords='offset points',
                color=ANNOTATION_COLOR,
                fontsize=ANNOTATION_FONTSIZE,
                fontweight='bold',
                ha=current_ha, # Use determined horizontal alignment
                va=current_va, # Use determined vertical alignment
                bbox=dict(boxstyle="round,pad=0.3", fc=ANNOTATION_BG, ec='grey', lw=0.5),
                arrowprops=current_arrowprops, # Use determined arrow properties
                clip_on=True
            )

    elif not name_col:
        print("\nWarning: Could not find 'NAME' column. Skipping annotations.")
    elif TOP_N_COUNTRIES_TO_ANNOTATE <= 0:
        print("\nInfo: Annotations disabled (TOP_N_COUNTRIES_TO_ANNOTATE <= 0).")


    # --- Final Customization ---
    main_title = 'Global Distribution of Online Camgirls'
    # Update subtitle to use the count of *valid* codes found
    subtitle = f'Based on approx. {len(models_data)} profiles sampled ({valid_codes_found} with valid country codes)'
    ax.set_title(main_title, fontdict={'fontsize': TITLE_FONTSIZE, 'fontweight' : 'bold'}, pad=20)
    fig.text(0.5, 0.91, subtitle, ha='center', va='top', fontsize=SUBTITLE_FONTSIZE, color='#444444')

    #  Date/Time Footer
    now_utc = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC') # Format date/time

    # Position the footer text (adjust coordinates and fontsize as needed)
    fig.text(0.05, 0.91, f"Generated: {now_utc}", ha='left', va='bottom', fontsize=8, color='#444444')
    # fig.text(0.02, 0.02, f"Generated: {now_utc}", fontsize=8, color='#666666')


    ax.set_axis_off()
    plt.subplots_adjust(top=0.88, bottom=0.06, left=0.05, right=0.95)



    # 6. Save Map
    print("\n--- 6. Saving Map ---")
    try:
        filename = output_filename if not timestampfilename else f"{datetime.datetime.now().strftime('%Y%m%d_%H%M')}_{output_filename}"
        OUTPUT_MAP_FILENAME = os.path.join(os.getcwd(), filename) # Save in current working directory
        plt.savefig(OUTPUT_MAP_FILENAME, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
        print(f"Adjusted map saved successfully as '{OUTPUT_MAP_FILENAME}'")
    except Exception as e:
        print(f"Error saving map: {e}")

    # plt.show() # Uncomment to display

    print("\nScript finished.")
    
if __name__ == "__main__":
    # check args for filename and timestamp
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate a heatmap of camgirl locations by country.")
    parser.add_argument(
        "-o",
        "--output_filename",
        type=str,
        default="stripchat_model_map.png",
        help="Base filename for the output map image (default: stripchat_model_map.png)",
    )
    parser.add_argument(
        "-t",
        "--timestamp",
        action="store_true",
        help="Include a timestamp in the output filename (e.g., 20241027_1430_stripchat_model_map.png)",
    )

    args = parser.parse_args()
    
    main(output_filename=args.output_filename, timestampfilename=args.timestamp)
    ```


