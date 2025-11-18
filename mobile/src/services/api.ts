import { supabase } from './supabase';

const GOLF_API_URL = process.env.EXPO_PUBLIC_GOLF_API_URL || 'https://api.golfcourseapi.com';
const GOLF_API_KEY = process.env.EXPO_PUBLIC_GOLF_API_KEY || '';

console.log('API Configuration:');
console.log('Golf API URL:', GOLF_API_URL);
console.log('Golf API Key:', GOLF_API_KEY ? GOLF_API_KEY.substring(0, 10) + '...' : 'NOT SET');

export async function searchCourses(q: string) {
  if (!GOLF_API_KEY) {
    throw new Error('Golf API key not configured');
  }

  // Use 'Key <API_KEY>' format as used in legs-open-2026
  const url = `${GOLF_API_URL}/v1/search?search_query=${encodeURIComponent(q)}`;
  console.log('Searching Golf API with Authorization Key header:', url);
  
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Key ${GOLF_API_KEY}`,
    },
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Golf API search failed:', res.status, errorText);
    throw new Error(`Failed to search courses: ${res.status}`);
  }
  
  const data = await res.json();
  return data.courses || [];
}

export async function getCourseDetails(courseId: string) {
  if (!GOLF_API_KEY) {
    throw new Error('Golf API key not configured');
  }

  const url = `${GOLF_API_URL}/v1/courses/${encodeURIComponent(courseId)}`;
  console.log('Fetching course details with Authorization Key header');
  
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Key ${GOLF_API_KEY}`,
    },
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Failed to get course details:', res.status, errorText);
    throw new Error('Failed to get course details');
  }
  
  const data = await res.json();
  // The API returns data wrapped in a "course" object
  return data.course || data;
}

export async function saveCourseToDatabase(courseData: any) {
  console.log('Saving course to database:', courseData.club_name || courseData.name);
  console.log('Course ID:', courseData.id);
  
  // Ensure we have a valid external_id
  const externalId = courseData.id?.toString() || courseData.external_id?.toString();
  if (!externalId) {
    throw new Error('Course data missing ID field');
  }
  
  // Save course to Supabase
  const courseUpsert = {
    external_id: externalId,
    name: courseData.club_name || courseData.name || 'Unnamed Course',
    city: courseData.location?.city || courseData.city || null,
    region: courseData.location?.state || courseData.region || courseData.state_abbr || null,
    country: courseData.location?.country || courseData.country || null,
    latitude: courseData.location?.lat || courseData.latitude || null,
    longitude: courseData.location?.lng || courseData.longitude || null,
    metadata: courseData,
  };

  console.log('Upserting course with external_id:', externalId);

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .upsert(courseUpsert, { onConflict: 'external_id' })
    .select()
    .single();

  if (courseError) {
    console.error('Error saving course:', courseError);
    throw courseError;
  }

  console.log('Course saved, processing tees...');

  // Extract tees from Golf API structure (tees.male and tees.female arrays)
  const allTees: any[] = [];
  
  if (courseData.tees) {
    // Add male tees
    if (Array.isArray(courseData.tees.male)) {
      console.log('Found male tees:', courseData.tees.male.length);
      courseData.tees.male.forEach((tee: any, index: number) => {
        if (tee.holes && tee.holes.length > 0) {
          allTees.push({
            name: `${tee.tee_name || `Tee ${index + 1}`} (Men's)`,
            tee_name: tee.tee_name,
            holes: tee.holes,
            slope_rating: tee.slope_rating || 113,
            course_rating: tee.course_rating || 72,
            par_total: tee.par_total || tee.holes.reduce((sum: number, h: any) => sum + (h.par || 0), 0),
            gender: 'male',
            color: tee.tee_color || null,
          });
        }
      });
    }
    
    // Add female tees
    if (Array.isArray(courseData.tees.female)) {
      console.log('Found female tees:', courseData.tees.female.length);
      courseData.tees.female.forEach((tee: any, index: number) => {
        if (tee.holes && tee.holes.length > 0) {
          allTees.push({
            name: `${tee.tee_name || `Tee ${index + 1}`} (Women's)`,
            tee_name: tee.tee_name,
            holes: tee.holes,
            slope_rating: tee.slope_rating || 113,
            course_rating: tee.course_rating || 72,
            par_total: tee.par_total || tee.holes.reduce((sum: number, h: any) => sum + (h.par || 0), 0),
            gender: 'female',
            color: tee.tee_color || null,
          });
        }
      });
    }
  }

  console.log('Total tees to save:', allTees.length);

  // Save tees to database
  for (const tee of allTees) {
    const teeUpsert = {
      course_id: course.id,
      tee_name: tee.name,
      tee_color: tee.color,
      rating: tee.course_rating,
      slope: tee.slope_rating,
      par_total: tee.par_total,
      metadata: {
        gender: tee.gender,
        holes: tee.holes,
        original_tee_name: tee.tee_name,
      },
    };
    
    const { error: teeError } = await supabase
      .from('course_tees')
      .upsert(teeUpsert, { onConflict: 'course_id,tee_name' });
    
    if (teeError) {
      console.error('Error saving tee:', teeError);
    } else {
      console.log('Saved tee:', tee.name);
    }
  }

  // Reload course with tees
  const { data: courseWithTees, error: reloadError } = await supabase
    .from('courses')
    .select('*, course_tees(*)')
    .eq('id', course.id)
    .single();

  if (reloadError) {
    console.error('Error reloading course:', reloadError);
    throw reloadError;
  }
  
  console.log('Course loaded with', courseWithTees.course_tees?.length || 0, 'tees');
  return courseWithTees;
}

export async function getUserClubs() {
  const { data, error } = await supabase
    .from('clubs')
    .select('club_type')
    .order('display_order', { ascending: true });
  
  if (error) {
    console.error('Error loading clubs:', error);
    return [];
  }
  
  return data.map(c => c.club_type);
}

export async function generateRoundSummary(roundId: string) {
  const { supabase } = await import('./supabase');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generateSummary/rounds/${roundId}/generate_summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate summary: ${response.status} ${errorText}`);
  }

  return await response.json();
}

export default { searchCourses, getCourseDetails, saveCourseToDatabase, getUserClubs, generateRoundSummary };
