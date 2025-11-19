import { Platform, Alert } from 'react-native';
// import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

let ExpoSpeechRecognitionModule: any = null;
try {
  // Safely attempt to load the native module
  // This is required because Expo Go does not have the native module linked
  // and the package throws an error on import if the module is missing
  ExpoSpeechRecognitionModule = require("expo-speech-recognition").ExpoSpeechRecognitionModule;
} catch (e) {
  console.log("ExpoSpeechRecognition native module not found (expected in Expo Go)");
}

// Voice input service for golf shot entry
// Provides speech-to-text functionality and natural language parsing for golf terms

export interface VoiceInputResult {
  originalText: string;
  parsedData: {
    club?: string;
    distance?: number;
    distanceUnit?: 'yards' | 'feet';
    shotShape?: 'draw' | 'fade' | 'straight' | 'hook' | 'slice' | 'pull' | 'push';
    trajectory?: 'low' | 'normal' | 'high';
    result?: 'good' | 'acceptable' | 'poor' | 'ob' | 'hazard' | 'lost';
    lie?: string;
    confidence: number; // 0-1 score
  };
  suggestions: string[];
}

// Real speech recognition using expo-speech-recognition
class RealSpeechRecognition {
  private isListening = false;
  private resolvePromise: ((value: string) => void) | null = null;
  private rejectPromise: ((reason?: any) => void) | null = null;
  private resultSubscription: any = null;
  private errorSubscription: any = null;

  async startListening(): Promise<string> {
    if (this.isListening) {
      throw new Error('Already listening');
    }

    if (!ExpoSpeechRecognitionModule) {
       throw new Error("Speech recognition module not found. Are you running in Expo Go?");
    }

    const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permissions.granted) {
      throw new Error('Microphone permission not granted');
    }

    this.isListening = true;

    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;

      // Clean up previous subscriptions if any
      this.cleanupSubscriptions();

      this.resultSubscription = ExpoSpeechRecognitionModule.addListener("result", (event) => {
        if (event.isFinal && event.results.length > 0) {
          const transcript = event.results[0].transcript;
          this.finish(transcript);
        }
      });

      this.errorSubscription = ExpoSpeechRecognitionModule.addListener("error", (event) => {
        // Ignore "no-speech" error if we just want to stop or retry, but here we reject
        this.error(new Error(event.message));
      });

      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: false,
        maxAlternatives: 1,
      });
    });
  }

  stopListening() {
    if (this.isListening) {
      ExpoSpeechRecognitionModule.stop();
    }
  }

  isCurrentlyListening() {
    return this.isListening;
  }

  private finish(result: string) {
    this.isListening = false;
    this.cleanupSubscriptions();
    if (this.resolvePromise) {
      this.resolvePromise(result);
      this.resolvePromise = null;
      this.rejectPromise = null;
    }
  }

  private error(err: Error) {
    this.isListening = false;
    this.cleanupSubscriptions();
    if (this.rejectPromise) {
      this.rejectPromise(err);
      this.resolvePromise = null;
      this.rejectPromise = null;
    }
  }

  private cleanupSubscriptions() {
    if (this.resultSubscription) {
      this.resultSubscription.remove();
      this.resultSubscription = null;
    }
    if (this.errorSubscription) {
      this.errorSubscription.remove();
      this.errorSubscription = null;
    }
  }
}

// Text input fallback for development and testing
class TextInputFallback {
  private isListening = false;

  async startListening(): Promise<string> {
    if (this.isListening) {
      throw new Error('Already listening');
    }

    this.isListening = true;
    
    if (Platform.OS === 'android') {
      return new Promise((resolve, reject) => {
        Alert.alert(
          'Voice Input Simulation (Android)',
          'Select a simulated voice input (Alert.prompt not supported on Android):',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => {
              this.isListening = false;
              reject(new Error('User cancelled'));
            }},
            { text: 'Driver 280y', onPress: () => {
              this.isListening = false;
              resolve('driver 280 yards straight');
            }},
            { text: '7 Iron 150y', onPress: () => {
              this.isListening = false;
              resolve('7 iron 150 yards draw');
            }},
            { text: 'Putter 15ft', onPress: () => {
              this.isListening = false;
              resolve('putter 15 feet straight');
            }}
          ]
        );
      });
    }

    return new Promise((resolve, reject) => {
      Alert.prompt(
        'Voice Input Simulation',
        'Enter your golf shot (e.g., "7 iron 150 yards straight"):',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => {
            this.isListening = false;
            reject(new Error('User cancelled'));
          }},
          { text: 'Submit', onPress: (text) => {
            this.isListening = false;
            resolve(text || 'driver 280 yards straight');
          }}
        ],
        'plain-text',
        '7 iron 150 yards straight' // Default text
      );
    });
  }

  async stopListening() {
    this.isListening = false;
  }

  isCurrentlyListening() {
    return this.isListening;
  }
}

// Mock speech recognition for development (since Expo Go doesn't support real speech recognition)
class MockSpeechRecognition {
  private isListening = false;
  private mockResults = [
    "driver 280 yards slight fade",
    "7 iron 150 yards straight",
    "pitching wedge 90 yards high",
    "putter 15 feet straight",
    "3 wood 230 yards draw",
    "sand wedge 60 yards from bunker",
    "approach shot 7 iron 140 yards",
    "tee shot driver 290 yards fairway"
  ];

  async startListening(): Promise<string> {
    if (this.isListening) {
      throw new Error('Already listening');
    }

    this.isListening = true;
    
    // Simulate speech recognition delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    
    // Return a random mock result
    const result = this.mockResults[Math.floor(Math.random() * this.mockResults.length)];
    this.isListening = false;
    
    return result;
  }

  stopListening() {
    this.isListening = false;
  }

  isCurrentlyListening() {
    return this.isListening;
  }
}

// Golf-specific terminology dictionary
const GOLF_TERMS = {
  clubs: {
    'driver': ['driver', 'big dog', '1 wood'],
    '3 wood': ['3 wood', 'three wood', 'fairway wood'],
    '5 wood': ['5 wood', 'five wood'],
    'hybrid': ['hybrid', 'rescue'],
    '3 iron': ['3 iron', 'three iron'],
    '4 iron': ['4 iron', 'four iron'],
    '5 iron': ['5 iron', 'five iron'],
    '6 iron': ['6 iron', 'six iron'],
    '7 iron': ['7 iron', 'seven iron'],
    '8 iron': ['8 iron', 'eight iron'],
    '9 iron': ['9 iron', 'nine iron'],
    'pitching wedge': ['pitching wedge', 'pw', 'pitch', 'pitching'],
    'sand wedge': ['sand wedge', 'sw', 'sand', 'bunker'],
    'lob wedge': ['lob wedge', 'lw', 'lob'],
    'putter': ['putter', 'put', 'putting']
  },
  
  shotShapes: {
    'draw': ['draw', 'draws', 'drawing', 'slight draw', 'baby draw'],
    'fade': ['fade', 'fades', 'fading', 'slight fade', 'baby fade'],
    'straight': ['straight', 'dead straight', 'right at it'],
    'hook': ['hook', 'hooks', 'hooking', 'big hook'],
    'slice': ['slice', 'slices', 'slicing', 'big slice'],
    'pull': ['pull', 'pulls', 'pulling', 'pulled'],
    'push': ['push', 'pushes', 'pushing', 'pushed']
  },
  
  trajectory: {
    'low': ['low', 'low flight', 'punch', 'knocked down'],
    'normal': ['normal', 'regular', 'standard'],
    'high': ['high', 'high flight', 'towering', 'balloon']
  },
  
  results: {
    'good': ['good', 'great', 'perfect', 'solid', 'pure', 'flushed'],
    'acceptable': ['ok', 'okay', 'alright', 'decent', 'acceptable'],
    'poor': ['poor', 'bad', 'terrible', 'mishit', 'thin', 'fat', 'topped'],
    'ob': ['ob', 'out of bounds', 'oob', 'white stakes'],
    'hazard': ['water', 'hazard', 'pond', 'creek', 'stream'],
    'lost': ['lost', 'lost ball', 'cant find it']
  },
  
  lies: {
    'fairway': ['fairway', 'short grass'],
    'rough': ['rough', 'long grass', 'heavy rough', 'light rough'],
    'bunker': ['bunker', 'sand', 'trap', 'sand trap'],
    'green': ['green', 'putting surface'],
    'tee': ['tee', 'tee box', 'teeing ground']
  }
};

class VoiceInputService {
  private inputHandler: TextInputFallback | MockSpeechRecognition | RealSpeechRecognition;
  
  constructor() {
    // Check if native module is available
    const isNativeModuleAvailable = !!ExpoSpeechRecognitionModule;
    
    if (isNativeModuleAvailable) {
      console.log('Using RealSpeechRecognition for voice input');
      this.inputHandler = new RealSpeechRecognition();
    } else {
      console.log('Native speech recognition not available (likely Expo Go), falling back to text input');
      this.inputHandler = new TextInputFallback();
    }
  }

  /**
   * Start listening for voice input
   */
  async startListening(): Promise<VoiceInputResult> {
    try {
      const speechText = await this.inputHandler.startListening();
      console.log('Voice input received:', speechText);
      return this.parseGolfSpeech(speechText);
    } catch (error) {
      throw new Error(`Voice recognition failed: ${error.message}`);
    }
  }

  /**
   * Stop listening for voice input
   */
  stopListening(): void {
    this.inputHandler.stopListening();
  }

  /**
   * Check if currently listening
   */
  isListening(): boolean {
    return this.inputHandler.isCurrentlyListening();
  }

  /**
   * Parse golf-specific speech into structured data
   */
  parseGolfSpeech(speechText: string): VoiceInputResult {
    const lowerText = speechText.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    const parsedData: VoiceInputResult['parsedData'] = {
      confidence: 0
    };

    let confidenceScore = 0;
    const maxConfidence = 6; // Number of fields we can extract

    // Extract club
    const club = this.extractClub(lowerText);
    if (club) {
      parsedData.club = club;
      confidenceScore++;
    }

    // Extract distance
    const distance = this.extractDistance(lowerText);
    if (distance) {
      parsedData.distance = distance.value;
      parsedData.distanceUnit = distance.unit;
      confidenceScore++;
    }

    // Extract shot shape
    const shotShape = this.extractShotShape(lowerText);
    if (shotShape) {
      parsedData.shotShape = shotShape as any;
      confidenceScore++;
    }

    // Extract trajectory
    const trajectory = this.extractTrajectory(lowerText);
    if (trajectory) {
      parsedData.trajectory = trajectory as any;
      confidenceScore++;
    }

    // Extract result quality
    const result = this.extractResult(lowerText);
    if (result) {
      parsedData.result = result as any;
      confidenceScore++;
    }

    // Extract lie
    const lie = this.extractLie(lowerText);
    if (lie) {
      parsedData.lie = lie;
      confidenceScore++;
    }

    parsedData.confidence = confidenceScore / maxConfidence;

    // Generate suggestions for improvement
    const suggestions = this.generateSuggestions(speechText, parsedData);

    return {
      originalText: speechText,
      parsedData,
      suggestions
    };
  }

  /**
   * Extract club from speech text
   */
  private extractClub(text: string): string | null {
    for (const [club, variations] of Object.entries(GOLF_TERMS.clubs)) {
      for (const variation of variations) {
        if (text.includes(variation)) {
          return club;
        }
      }
    }
    return null;
  }

  /**
   * Extract distance and unit
   */
  private extractDistance(text: string): { value: number; unit: 'yards' | 'feet' } | null {
    // Look for patterns like "150 yards", "15 feet", "280"
    const yardPattern = /(\d+)\s*(?:yards?|yds?|y)\b/i;
    const feetPattern = /(\d+)\s*(?:feet|ft|f)\b/i;
    const numberPattern = /\b(\d+)\b/;

    const yardMatch = text.match(yardPattern);
    if (yardMatch) {
      return { value: parseInt(yardMatch[1]), unit: 'yards' };
    }

    const feetMatch = text.match(feetPattern);
    if (feetMatch) {
      return { value: parseInt(feetMatch[1]), unit: 'feet' };
    }

    // If just a number, assume yards for longer distances, feet for shorter
    const numberMatch = text.match(numberPattern);
    if (numberMatch) {
      const value = parseInt(numberMatch[1]);
      // Assume feet for putts (< 30), yards for everything else
      const unit = value < 30 ? 'feet' : 'yards';
      return { value, unit };
    }

    return null;
  }

  /**
   * Extract shot shape
   */
  private extractShotShape(text: string): string | null {
    for (const [shape, variations] of Object.entries(GOLF_TERMS.shotShapes)) {
      for (const variation of variations) {
        if (text.includes(variation)) {
          return shape;
        }
      }
    }
    return null;
  }

  /**
   * Extract trajectory
   */
  private extractTrajectory(text: string): string | null {
    for (const [traj, variations] of Object.entries(GOLF_TERMS.trajectory)) {
      for (const variation of variations) {
        if (text.includes(variation)) {
          return traj;
        }
      }
    }
    return null;
  }

  /**
   * Extract result quality
   */
  private extractResult(text: string): string | null {
    for (const [result, variations] of Object.entries(GOLF_TERMS.results)) {
      for (const variation of variations) {
        if (text.includes(variation)) {
          return result;
        }
      }
    }
    return null;
  }

  /**
   * Extract lie information
   */
  private extractLie(text: string): string | null {
    for (const [lie, variations] of Object.entries(GOLF_TERMS.lies)) {
      for (const variation of variations) {
        if (text.includes(variation)) {
          return lie;
        }
      }
    }
    return null;
  }

  /**
   * Generate suggestions for better voice input
   */
  private generateSuggestions(originalText: string, parsedData: any): string[] {
    const suggestions: string[] = [];

    if (!parsedData.club) {
      suggestions.push("Try saying the club name more clearly (e.g., 'driver', '7 iron')");
    }

    if (!parsedData.distance) {
      suggestions.push("Include the distance (e.g., '150 yards', '15 feet')");
    }

    if (parsedData.confidence < 0.5) {
      suggestions.push("Speak more slowly and clearly for better recognition");
      suggestions.push("Try: 'Club, distance, shot shape' (e.g., '7 iron, 150 yards, straight')");
    }

    if (suggestions.length === 0) {
      suggestions.push("Great! All key information was recognized.");
    }

    return suggestions;
  }

  /**
   * Get example phrases for voice input
   */
  getExamplePhrases(): string[] {
    return [
      "Driver, 280 yards, slight fade",
      "7 iron, 150 yards, straight to the pin",
      "Pitching wedge, 90 yards, high and soft",
      "Putter, 15 feet, left to right break",
      "Sand wedge from bunker, 60 yards",
      "3 wood, 230 yards, slight draw",
      "Approach shot, 6 iron, 140 yards",
      "Tee shot, driver, 290 yards to fairway"
    ];
  }

  /**
   * Get quick voice tips for users
   */
  getVoiceTips(): string[] {
    return [
      "Speak clearly and at normal pace",
      "Include club, distance, and shot shape",
      "Use common golf terms like 'driver', 'fairway', 'fade'",
      "Say distances with units: '150 yards' or '15 feet'",
      "Describe shot results: 'good', 'poor', 'water hazard'",
      "Mention lie conditions: 'from rough', 'fairway bunker'"
    ];
  }
}

export const voiceInputService = new VoiceInputService();
export default voiceInputService;