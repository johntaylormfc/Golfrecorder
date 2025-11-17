import { supabase } from './supabase';

const EDGE_BASE = process.env.GOLF_API_EDGE_URL || process.env.EXPO_APP_API_URL || '';

export async function searchCourses(q: string, near?: { lat: number; lng: number }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (near) params.set('near', `${near.lat},${near.lng}`);

  const url = `${EDGE_BASE}/courses/search?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to search courses: ${res.status}`);
  return res.json();
}

export async function getCourse(courseId: string, refresh = false) {
  const url = `${EDGE_BASE}/courses/${encodeURIComponent(courseId)}?refresh=${refresh ? 'true' : 'false'}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to get course');
  return res.json();
}

export async function generateRoundSummary(roundId: string) {
  const url = `${EDGE_BASE}/rounds/${encodeURIComponent(roundId)}/generate_summary`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to generate summary (${res.status})`);
  }
  return res.json();
}

export default { searchCourses, getCourse, generateRoundSummary };
