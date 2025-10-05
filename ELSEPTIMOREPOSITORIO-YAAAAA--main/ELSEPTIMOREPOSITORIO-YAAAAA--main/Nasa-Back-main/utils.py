# app/utils.py
import math

# Constantes físicas
Tnt_to_Joules = 4.184e15  # Joules por megatón de TNT

def calculate_impact_energy(diameter_m, velocity_kms, density_kgm3):
    """
    Calcula la energía cinética de un asteroide en megatones de TNT.
    """
    if diameter_m <= 0 or velocity_kms <= 0 or density_kgm3 <= 0:
        return 0
    velocity_ms = velocity_kms * 1000
    radius_m = diameter_m / 2
    volume_m3 = (4/3) * math.pi * (radius_m ** 3)
    mass_kg = volume_m3 * density_kgm3
    kinetic_energy_joules = 0.5 * mass_kg * (velocity_ms ** 2)
    return kinetic_energy_joules / Tnt_to_Joules

def calculate_crater_diameter(energy_megatons, target_density_kgm3=1800):
    """
    Estima el diámetro del cráter de impacto en metros.
    """
    if energy_megatons <= 0:
        return 0
    energy_joules = energy_megatons * Tnt_to_Joules
    Cf = 1.161
    transient_diameter = Cf * (energy_joules / target_density_kgm3) ** (1 / 3.4)
    final_diameter_meters = transient_diameter * 1.25
    return final_diameter_meters