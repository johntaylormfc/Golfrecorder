import { Platform } from 'react-native';
import * as Location from 'expo-location';

// Types for weather data
export interface WeatherData {
  temperature: number; // Fahrenheit
  humidity: number; // Percentage
  windSpeed: number; // mph
  windDirection: number; // degrees
  windGust?: number; // mph
  description: string; // e.g., "Clear sky", "Light rain"
  visibility: number; // miles
  pressure: number; // inHg
  uvIndex?: number;
  feelsLike: number; // Fahrenheit
  timestamp: string; // ISO string
  location: {
    lat: number;
    lon: number;
    name?: string;
  };
}

export interface WeatherConditions {
  temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  wind_gust?: number;
  description: string;
  visibility: number;
  pressure: number;
  uv_index?: number;
  feels_like: number;
}

class WeatherService {
  private apiKey: string = 'demo'; // Will use demo data if no API key
  private baseUrl: string = 'https://api.openweathermap.org/data/2.5';

  constructor() {
    // In a real implementation, you would get this from environment variables
    // For now, we'll use demo data
    this.apiKey = 'demo';
  }

  /**
   * Get current weather for a location
   */
  async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
    if (this.apiKey === 'demo') {
      return this.getDemoWeatherData(lat, lon);
    }

    try {
      const url = `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=imperial`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseOpenWeatherResponse(data);
    } catch (error) {
      console.warn('Weather API failed, using demo data:', error);
      return this.getDemoWeatherData(lat, lon);
    }
  }

  /**
   * Get weather for current device location
   */
  async getCurrentLocationWeather(): Promise<WeatherData | null> {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return null;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      return await this.getCurrentWeather(latitude, longitude);
    } catch (error) {
      console.warn('Failed to get location weather:', error);
      return null;
    }
  }

  /**
   * Get weather for a golf course location (if coordinates available)
   */
  async getCourseWeather(courseData: any): Promise<WeatherData | null> {
    try {
      // Try to extract coordinates from course data
      let lat: number | undefined;
      let lon: number | undefined;

      if (courseData.latitude && courseData.longitude) {
        lat = courseData.latitude;
        lon = courseData.longitude;
      } else if (courseData.location?.lat && courseData.location?.lon) {
        lat = courseData.location.lat;
        lon = courseData.location.lon;
      } else if (courseData.coords?.latitude && courseData.coords?.longitude) {
        lat = courseData.coords.latitude;
        lon = courseData.coords.longitude;
      }

      if (!lat || !lon) {
        console.log('No coordinates available for course weather');
        return await this.getCurrentLocationWeather();
      }

      const weather = await this.getCurrentWeather(lat, lon);
      if (weather.location) {
        weather.location.name = courseData.name || 'Golf Course';
      }
      
      return weather;
    } catch (error) {
      console.warn('Failed to get course weather:', error);
      return await this.getCurrentLocationWeather();
    }
  }

  /**
   * Parse OpenWeatherMap API response
   */
  private parseOpenWeatherResponse(data: any): WeatherData {
    return {
      temperature: Math.round(data.main.temp),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind?.speed * 2.237), // Convert m/s to mph
      windDirection: data.wind?.deg || 0,
      windGust: data.wind?.gust ? Math.round(data.wind.gust * 2.237) : undefined,
      description: data.weather[0]?.description || 'Clear',
      visibility: Math.round((data.visibility || 10000) / 1609.34), // Convert m to miles
      pressure: Math.round(data.main.pressure * 0.02953), // Convert hPa to inHg
      uvIndex: data.uvi,
      feelsLike: Math.round(data.main.feels_like),
      timestamp: new Date().toISOString(),
      location: {
        lat: data.coord.lat,
        lon: data.coord.lon,
        name: data.name,
      },
    };
  }

  /**
   * Generate realistic demo weather data
   */
  private getDemoWeatherData(lat: number, lon: number): WeatherData {
    // Generate somewhat realistic weather based on current time/season
    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth(); // 0-11
    
    // Base temperature varies by season
    let baseTemp = 70;
    if (month >= 11 || month <= 2) baseTemp = 45; // Winter
    else if (month >= 3 && month <= 5) baseTemp = 65; // Spring
    else if (month >= 6 && month <= 8) baseTemp = 80; // Summer
    else baseTemp = 70; // Fall

    // Slight random variation
    const temp = baseTemp + Math.random() * 20 - 10;
    const windSpeed = Math.random() * 15 + 2; // 2-17 mph
    
    // Weather conditions based on randomness
    const conditions = [
      'Clear sky',
      'Few clouds', 
      'Scattered clouds',
      'Partly cloudy',
      'Overcast',
    ];
    
    return {
      temperature: Math.round(temp),
      humidity: Math.round(40 + Math.random() * 40), // 40-80%
      windSpeed: Math.round(windSpeed),
      windDirection: Math.round(Math.random() * 360),
      windGust: windSpeed > 10 ? Math.round(windSpeed * 1.3) : undefined,
      description: conditions[Math.floor(Math.random() * conditions.length)],
      visibility: Math.round(8 + Math.random() * 2), // 8-10 miles
      pressure: Math.round(29.8 + Math.random() * 0.4), // 29.8-30.2 inHg
      uvIndex: hour > 10 && hour < 16 ? Math.round(Math.random() * 8 + 2) : undefined,
      feelsLike: Math.round(temp + (Math.random() * 6 - 3)),
      timestamp: new Date().toISOString(),
      location: {
        lat,
        lon,
        name: 'Current Location',
      },
    };
  }

  /**
   * Format weather description for display
   */
  formatWeatherSummary(weather: WeatherData): string {
    const windDesc = weather.windSpeed > 15 ? 'windy' : 
                     weather.windSpeed > 8 ? 'breezy' : 'calm';
    
    return `${weather.temperature}°F, ${weather.description}, ${windDesc} (${weather.windSpeed} mph wind)`;
  }

  /**
   * Get wind direction as compass direction
   */
  getWindDirection(degrees: number): string {
    const directions = [
      'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
    ];
    
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  /**
   * Analyze weather impact on golf
   */
  getGolfConditionsAnalysis(weather: WeatherData): {
    impact: 'excellent' | 'good' | 'challenging' | 'difficult';
    factors: string[];
    recommendations: string[];
  } {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let impact: 'excellent' | 'good' | 'challenging' | 'difficult' = 'good';

    // Temperature analysis
    if (weather.temperature < 40) {
      factors.push('Very cold conditions');
      recommendations.push('Dress warmly, ball will travel less');
      impact = 'challenging';
    } else if (weather.temperature < 50) {
      factors.push('Cool conditions');
      recommendations.push('Ball may travel 5-10% less distance');
    } else if (weather.temperature > 90) {
      factors.push('Very hot conditions');
      recommendations.push('Stay hydrated, ball will travel further');
      if (impact === 'good') impact = 'challenging';
    }

    // Wind analysis
    if (weather.windSpeed > 20) {
      factors.push(`Strong winds (${weather.windSpeed} mph)`);
      recommendations.push('Club up/down significantly, aim for center of greens');
      impact = 'difficult';
    } else if (weather.windSpeed > 12) {
      factors.push(`Moderate winds (${weather.windSpeed} mph)`);
      recommendations.push('Adjust club selection and aim points');
      if (impact === 'excellent') impact = 'challenging';
    } else if (weather.windSpeed < 5) {
      factors.push('Calm conditions');
      if (impact === 'good') impact = 'excellent';
    }

    // Humidity/comfort
    if (weather.humidity > 80) {
      factors.push('High humidity');
      recommendations.push('Ball may travel slightly less, grip may be slippery');
    }

    // Visibility
    if (weather.visibility < 5) {
      factors.push('Poor visibility');
      recommendations.push('Be extra careful with target selection');
      if (impact === 'excellent' || impact === 'good') impact = 'challenging';
    }

    return { impact, factors, recommendations };
  }
}

export const weatherService = new WeatherService();
export default weatherService;