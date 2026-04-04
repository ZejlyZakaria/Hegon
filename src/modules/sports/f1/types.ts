// =====================================================
// F1 TYPES
// =====================================================

export interface TeamConfig {
  primary: string;
  secondary: string;
  name: string;
}

export interface F1Driver {
  id: string;
  jolpica_id: string;
  name: string;
  number: number;
  country_code: string;
}

export interface F1Team {
  id: string;
  jolpica_id: string;
  name: string;
  full_name: string;
}

export interface F1Circuit {
  id: string;
  jolpica_id: string;
  circuit_name: string; 
  country: string;
  country_code: string;
  locality: string;     
  circuit_svg_url: string | null; 
}

export interface F1Race {
  id: string;
  season: number;
  round: number;
  race_name: string;
  circuit_id: string;
  race_date: string;
  race_time: string | null;
  quali_date: string | null; 
  quali_time: string | null;  
  status: 'upcoming' | 'completed';
  f1_circuits?: F1Circuit; 
}

export interface F1Result {
  id: string;
  race_id: string;
  driver_id: string;
  team_id: string;
  position: number;
  points: number;
  driver?: F1Driver;
  team?: F1Team;
}

export interface F1DriverStanding {
  id: string;
  season: number;
  driver_id: string;
  team_id: string;
  position: number;
  points: number;
  wins: number;
  driver?: F1Driver;
  team?: F1Team;
}

export interface F1ConstructorStanding {
  id: string;
  season: number;
  team_id: string;
  position: number;
  points: number;
  wins: number;
  team?: F1Team;
}