#!/usr/bin/env python3
"""
NASA Near Earth Objects (NEO) Data Fetcher

This script fetches Near Earth Objects data from NASA's NEO API
and saves it to a JSON file for use in the Three.js Earth visualization.
"""

import requests
import json
import math
from datetime import datetime, timedelta

def calculate_orbital_velocity(semi_major_axis, current_radius):
    """
    Calculate orbital velocity using vis-viva equation
    v = sqrt(GM * (2/r - 1/a))
    Where GM for Sun ≈ 1.327 × 10^20 m³/s² (scaled for our units)
    """
    # Gravitational parameter for Sun (scaled for our scene units)
    # Using simplified physics for visualization
    GM = 1.0  # Scaled down for our coordinate system
    
    # Vis-viva equation: v = sqrt(GM * (2/r - 1/a))
    # Ensure we don't get negative values under square root
    inner_value = GM * (2.0 / current_radius - 1.0 / semi_major_axis)
    
    # If the value would be negative, use a simplified circular velocity
    if inner_value <= 0:
        # For circular orbit: v = sqrt(GM/r)
        velocity_magnitude = math.sqrt(GM / current_radius) * 0.1  # Scale down for visualization
    else:
        velocity_magnitude = math.sqrt(inner_value) * 0.1  # Scale down for visualization
    
    return velocity_magnitude

def calculate_neo_mass(diameter_meters, density_kg_m3=2600):
    """
    Calculate NEO mass based on diameter and assumed density
    
    Args:
        diameter_meters: Diameter in meters
        density_kg_m3: Density in kg/m³ (default: 2600 for stony asteroids)
    
    Returns:
        Mass in kilograms
    """
    radius_meters = diameter_meters / 2
    volume_m3 = (4/3) * math.pi * (radius_meters ** 3)
    mass_kg = volume_m3 * density_kg_m3
    return mass_kg

def calculate_impact_energy(mass_kg, velocity_km_s):
    """
    Calculate kinetic energy of impact in kilotons of TNT equivalent
    
    Args:
        mass_kg: Mass in kilograms
        velocity_km_s: Impact velocity in km/s (typical NEO impact: 10-70 km/s)
    
    Returns:
        Energy in kilotons of TNT equivalent
    """
    # Convert velocity from km/s to m/s
    velocity_m_s = velocity_km_s * 1000
    
    # Calculate kinetic energy: KE = 0.5 * m * v²
    kinetic_energy_joules = 0.5 * mass_kg * (velocity_m_s ** 2)
    
    # Convert to kilotons of TNT
    # 1 kiloton TNT = 4.184 × 10^12 joules
    kilotons_tnt_per_joule = 1 / (4.184e12)
    energy_kilotons = kinetic_energy_joules * kilotons_tnt_per_joule
    
    return energy_kilotons

def estimate_impact_velocity(semi_major_axis_au):
    """
    Estimate typical Earth impact velocity for a NEO based on its orbit
    
    Args:
        semi_major_axis_au: Semi-major axis in AU
    
    Returns:
        Estimated impact velocity in km/s
    """
    # Earth's escape velocity: ~11.2 km/s
    # Earth's orbital velocity: ~29.8 km/s
    # NEO orbital velocities vary based on their orbits
    
    # Simplified model based on orbital characteristics
    # NEOs with orbits closer to Earth tend to have higher relative velocities
    if semi_major_axis_au < 1.0:  # Inside Earth's orbit
        return 25.0  # Higher relative velocity
    elif semi_major_axis_au < 1.3:  # Close to Earth's orbit
        return 20.0  # Moderate relative velocity
    elif semi_major_axis_au < 2.0:  # Main belt region
        return 15.0  # Lower relative velocity
    else:  # Outer regions
        return 12.0  # Minimal relative velocity

def get_impact_description(energy_kilotons):
    """
    Provide qualitative description of impact scale
    
    Args:
        energy_kilotons: Impact energy in kilotons
    
    Returns:
        Tuple of (scale_category, description, historical_comparison)
    """
    if energy_kilotons < 0.001:
        return ("Negligible", "Small meteorite - burns up in atmosphere", "Typical shooting star")
    elif energy_kilotons < 0.01:
        return ("Very Small", "Small meteorite impact", "Car-sized object")
    elif energy_kilotons < 0.1:
        return ("Small", "Local damage possible", "House-sized object")
    elif energy_kilotons < 1.0:
        return ("Moderate", "City block damage", "Chelyabinsk meteor (2013)")
    elif energy_kilotons < 15:
        return ("Large", "City-wide destruction", "Hiroshima bomb equivalent")
    elif energy_kilotons < 100:
        return ("Very Large", "Regional devastation", "Large nuclear weapon")
    elif energy_kilotons < 1000:
        return ("Massive", "Country-wide effects", "Tunguska event (1908)")
    elif energy_kilotons < 10000:
        return ("Catastrophic", "Continental damage", "Large hydrogen bomb")
    elif energy_kilotons < 100000:
        return ("Global", "Global climate effects", "K-Pg boundary impactor scale")
    else:
        return ("Extinction", "Mass extinction event", "Dinosaur extinction level")

def calculate_impact_statistics(diameter_meters, semi_major_axis_au, density_kg_m3=2600):
    """
    Calculate comprehensive impact statistics for a NEO
    
    Args:
        diameter_meters: Diameter in meters
        semi_major_axis_au: Semi-major axis in AU
        density_kg_m3: Density in kg/m³
    
    Returns:
        Dictionary with impact statistics
    """
    mass_kg = calculate_neo_mass(diameter_meters, density_kg_m3)
    impact_velocity = estimate_impact_velocity(semi_major_axis_au)
    energy_kilotons = calculate_impact_energy(mass_kg, impact_velocity)
    scale_category, description, comparison = get_impact_description(energy_kilotons)
    
    return {
        'mass_kg': mass_kg,
        'mass_tons': mass_kg / 1000,
        'volume_m3': (4/3) * math.pi * ((diameter_meters/2) ** 3),
        'impact_velocity_km_s': impact_velocity,
        'energy_kilotons': energy_kilotons,
        'energy_megatons': energy_kilotons / 1000,
        'scale_category': scale_category,
        'description': description,
        'historical_comparison': comparison
    }

def calculate_trajectory_points(position, velocity, orbit_radius, inclination, eccentricity=0.1, num_points=100, orbit_fraction=0.75):
    """
    Calculate comprehensive trajectory points for visualization showing a significant portion of the orbit
    Returns a list of points showing the predicted orbital path
    
    Args:
        position: Current position dict with x, y, z
        velocity: Orbital velocity
        orbit_radius: Semi-major axis of orbit
        inclination: Orbital inclination in degrees
        eccentricity: Orbital eccentricity (0 = circular, <1 = elliptical)
        num_points: Number of trajectory points to generate
        orbit_fraction: Fraction of orbit to show (0.75 = 3/4 of complete orbit)
    """
    trajectory_points = []
    
    # Convert inclination to radians
    inclination_rad = math.radians(inclination)
    
    # Calculate current angle in orbit
    current_angle = math.atan2(position['z'], position['x'])
    
    # Calculate angular step to cover the desired orbit fraction
    total_angle = 2 * math.pi * orbit_fraction  # Radians to cover
    angle_step = total_angle / num_points
    
    for i in range(num_points):
        # Calculate angle for this point
        angle = current_angle + (i * angle_step)
        
        # Calculate distance from focus (accounting for eccentricity)
        # For elliptical orbit: r = a(1-e²)/(1+e*cos(θ))
        # For simplification in visualization, use: r = orbit_radius * (1 + eccentricity * cos(angle))
        distance = orbit_radius * (1 + eccentricity * math.cos(angle))
        
        # Calculate position in orbital plane
        x_orbital = distance * math.cos(angle)
        z_orbital = distance * math.sin(angle)
        
        # Apply inclination (rotate around x-axis)
        x = x_orbital
        y = z_orbital * math.sin(inclination_rad)
        z = z_orbital * math.cos(inclination_rad)
        
        trajectory_points.append({'x': x, 'y': y, 'z': z})
    
    return trajectory_points

def fetch_nasa_neos():
    """
    Fetch Near Earth Objects data from NASA's NEO API
    API: https://api.nasa.gov/neo/rest/v1/neo/browse?api_key=DEMO_KEY
    """
    
    # NASA NEO API endpoint
    base_url = "https://api.nasa.gov/neo/rest/v1/neo/browse"
    
    params = {
        "api_key": "N3XChOFuv4MAG8lvarqKN2dIEQDobrdLxgoaQE5b",
        "size": 100,  # Number of NEOs to fetch
        "page": 0
    }
    
    try:
        print("Fetching Near Earth Objects data from NASA NEO API...")
        response = requests.get(base_url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        neos_raw = data.get('near_earth_objects', [])
        
        print(f"Retrieved {len(neos_raw)} Near Earth Objects from NASA API")
        
        # Process NEOs for Three.js
        processed_neos = []
        
        for neo in neos_raw:
            try:
                # Extract required fields
                name = neo.get('name', 'Unknown NEO')
                neo_id = neo.get('id', 'unknown')
                
                # Get estimated diameter (in meters)
                diameter_data = neo.get('estimated_diameter', {}).get('meters', {})
                diameter_min = diameter_data.get('estimated_diameter_min', 100)
                diameter_max = diameter_data.get('estimated_diameter_max', 1000)
                avg_diameter = (diameter_min + diameter_max) / 2
                
                # Get orbital data
                orbital_data = neo.get('orbital_data', {})
                semi_major_axis = float(orbital_data.get('semi_major_axis', 1.5))  # AU
                eccentricity = float(orbital_data.get('eccentricity', 0.1))
                inclination = float(orbital_data.get('inclination', 5))  # degrees
                
                # Check if potentially hazardous
                is_hazardous = neo.get('is_potentially_hazardous_asteroid', False)
                
                # Generate orbital position (simplified circular orbit for visualization)
                # Convert semi-major axis from AU to our scene units (Earth-Moon system scale)
                # 1 AU ≈ 150 million km, Earth-Moon distance ≈ 384,400 km
                # In our scene: Earth-Moon distance = 60 units
                # So 1 AU ≈ 60 * (150M / 0.384M) ≈ 23,437 units (too big for visualization)
                # Scale it down for better visualization
                
                orbit_radius = max(80, min(300, semi_major_axis * 50))  # Scale for visibility
                
                # Random position on orbit (since we don't have real-time position data)
                angle = hash(neo_id) % 360  # Deterministic but varied positioning
                angle_rad = math.radians(angle)
                
                # Apply inclination
                inclination_rad = math.radians(inclination)
                
                x = orbit_radius * math.cos(angle_rad)
                z = orbit_radius * math.sin(angle_rad) * math.cos(inclination_rad)
                y = orbit_radius * math.sin(angle_rad) * math.sin(inclination_rad)
                
                # Calculate size for visualization (scaled down from real size)
                size = max(0.2, min(2.0, math.log10(avg_diameter) * 0.3))
                
                # Calculate orbital velocity and trajectory
                current_radius = orbit_radius
                velocity = calculate_orbital_velocity(semi_major_axis, current_radius)
                trajectory = calculate_trajectory_points(
                    {'x': x, 'y': y, 'z': z}, 
                    velocity, 
                    orbit_radius, 
                    inclination, 
                    eccentricity,
                    num_points=120,  # More points for smoother curves
                    orbit_fraction=0.8  # Show 80% of orbit
                )
                
                # Ensure the meteorite position matches the first trajectory point
                if trajectory and len(trajectory) > 0:
                    first_point = trajectory[0]
                    x, y, z = first_point['x'], first_point['y'], first_point['z']
                
                # Calculate impact statistics
                impact_stats = calculate_impact_statistics(avg_diameter, semi_major_axis)
                
                processed_neo = {
                    'name': name.replace('(', '').replace(')', ''),  # Clean name
                    'id': neo_id,
                    'position': {'x': x, 'y': y, 'z': z},
                    'diameter_meters': avg_diameter,
                    'orbit_radius_au': semi_major_axis,
                    'eccentricity': eccentricity,
                    'inclination': inclination,
                    'is_hazardous': is_hazardous,
                    'size': size,
                    'velocity': velocity,
                    'trajectory': trajectory,
                    'impact_stats': impact_stats
                }
                
                processed_neos.append(processed_neo)
                
            except (ValueError, TypeError, KeyError) as e:
                print(f"Skipping NEO due to data error: {e}")
                continue
        
        print(f"Processed {len(processed_neos)} valid Near Earth Objects")
        
        if len(processed_neos) > 0:
            return create_neo_output_file(processed_neos, base_url)
        else:
            print("No valid NEO data found")
            return None
        
    except requests.RequestException as e:
        print(f"Error fetching data from NASA NEO API: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON response: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None

def create_neo_output_file(processed_neos, source_url):
    """Create the output JSON file for NEOs"""
    # Separate hazardous and non-hazardous asteroids
    hazardous_count = sum(1 for neo in processed_neos if neo['is_hazardous'])
    
    output_data = {
        'metadata': {
            'count': len(processed_neos),
            'hazardous_count': hazardous_count,
            'last_updated': datetime.now().isoformat(),
            'source': 'NASA Near Earth Object Web Service (NeoWs)',
            'api_url': source_url,
            'type': 'near_earth_objects'
        },
        'neos': processed_neos
    }
    
    with open('meteorites_data.json', 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"NEO data saved to meteorites_data.json")
    print(f"Total NEOs: {len(processed_neos)}")
    print(f"Potentially hazardous: {hazardous_count}")
    
    if processed_neos:
        diameters = [neo['diameter_meters'] for neo in processed_neos]
        print(f"Diameter range: {min(diameters):.1f} - {max(diameters):.1f} meters")
        print(f"Average diameter: {sum(diameters)/len(diameters):.1f} meters")
    
    return output_data
    return output_data

def create_sample_data():
    """
    Create sample NEO data if NASA API is unavailable
    """
    print("Creating sample Near Earth Objects data...")
    
    # Some known Near Earth Objects
    sample_neos = [
        {'name': '433 Eros', 'diameter': 16840, 'orbit_radius': 1.46, 'hazardous': False, 'id': '2000433'},
        {'name': '1036 Ganymed', 'diameter': 31660, 'orbit_radius': 2.66, 'hazardous': False, 'id': '1001036'},
        {'name': '1566 Icarus', 'diameter': 1400, 'orbit_radius': 1.08, 'hazardous': True, 'id': '1001566'},
        {'name': '2062 Aten', 'diameter': 800, 'orbit_radius': 0.97, 'hazardous': True, 'id': '2002062'},
        {'name': '3122 Florence', 'diameter': 4500, 'orbit_radius': 1.77, 'hazardous': True, 'id': '3003122'},
        {'name': '4179 Toutatis', 'diameter': 2500, 'orbit_radius': 2.53, 'hazardous': True, 'id': '4004179'},
        {'name': '4660 Nereus', 'diameter': 330, 'orbit_radius': 1.49, 'hazardous': True, 'id': '4004660'},
        {'name': '99942 Apophis', 'diameter': 370, 'orbit_radius': 0.92, 'hazardous': True, 'id': '2099942'},
        {'name': '101955 Bennu', 'diameter': 492, 'orbit_radius': 1.13, 'hazardous': True, 'id': '2101955'},
        {'name': '162173 Ryugu', 'diameter': 900, 'orbit_radius': 1.19, 'hazardous': False, 'id': '2162173'}
    ]
    
    processed_neos = []
    
    for i, neo in enumerate(sample_neos):
        orbit_radius = max(80, min(300, neo['orbit_radius'] * 50))
        
        # Distribute around orbit
        angle = (i * 36) % 360  # Spread them out
        angle_rad = math.radians(angle)
        inclination_rad = math.radians(i * 5)  # Vary inclination
        
        x = orbit_radius * math.cos(angle_rad)
        z = orbit_radius * math.sin(angle_rad) * math.cos(inclination_rad)
        y = orbit_radius * math.sin(angle_rad) * math.sin(inclination_rad)
        
        size = max(0.3, min(2.0, math.log10(neo['diameter']) * 0.5))
        
        # Calculate orbital velocity and trajectory for sample data
        current_radius = orbit_radius
        velocity = calculate_orbital_velocity(neo['orbit_radius'], current_radius)
        trajectory = calculate_trajectory_points(
            {'x': x, 'y': y, 'z': z}, 
            velocity, 
            orbit_radius, 
            i * 5, 
            eccentricity=0.1,
            num_points=120,  # More points for smoother curves
            orbit_fraction=0.8  # Show 80% of orbit
        )
        
        processed_neo = {
            'name': neo['name'],
            'id': neo['id'],
            'position': {'x': x, 'y': y, 'z': z},
            'diameter_meters': neo['diameter'],
            'orbit_radius_au': neo['orbit_radius'],
            'eccentricity': 0.1,
            'inclination': i * 5,
            'is_hazardous': neo['hazardous'],
            'size': size,
            'velocity': velocity,
            'trajectory': trajectory
        }
        
        processed_neos.append(processed_neo)
    
    hazardous_count = sum(1 for neo in processed_neos if neo['is_hazardous'])
    
    output_data = {
        'metadata': {
            'count': len(processed_neos),
            'hazardous_count': hazardous_count,
            'last_updated': datetime.now().isoformat(),
            'source': 'Sample Data (NASA NEO API unavailable)',
            'api_url': 'sample',
            'type': 'near_earth_objects'
        },
        'neos': processed_neos
    }
    
    with open('meteorites_data.json', 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"Sample NEO data saved to meteorites_data.json")
    print(f"Total NEOs: {len(processed_neos)}")
    print(f"Potentially hazardous: {hazardous_count}")
    return output_data

if __name__ == "__main__":
    print("NASA Near Earth Objects (NEO) Data Fetcher")
    print("=" * 50)
    
    # Try to fetch real NEO data from NASA API
    data = fetch_nasa_neos()
    
    # If NASA API fails, create sample data
    if data is None:
        print("\nNASA NEO API unavailable, creating sample data...")
        data = create_sample_data()
    
    print("\nDone! Run the HTML file to see Near Earth Objects rendered around Earth.")
