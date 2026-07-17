import { supabaseAdmin } from './lib/supabase/admin';

async function main() {
  const db = supabaseAdmin();
  const { data: elders } = await db.from('elders').select('id').limit(1);
  if (elders && elders.length > 0) {
    const elderId = elders[0].id;
    
    // Insert mock health fact
    await db.from('facts').insert([
      { elder_id: elderId, category: 'health', key: 'medication_bp', value: 'Takes blood pressure medication every morning.' },
      { elder_id: elderId, category: 'health', key: 'issue_knee', value: 'Knee aches sometimes when walking up stairs.' }
    ]);
    console.log('Inserted mock facts.');
  }
}
main();
