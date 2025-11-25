import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runVerification() {
  console.log('Starting Verification...');

  // 1. Setup: Get a test user (or create one, but let's use the first one found)
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError || !users || !users.users.length) {
    console.error('Failed to get users:', userError);
    return;
  }
  const firstUser = users.users[0];
  if (!firstUser) {
    console.error('No user found');
    return;
  }
  const userId = firstUser.id;
  console.log('Using User ID:', userId);

  // Get organization
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .single();

  if (!membership) {
    console.error('No membership found for user');
    return;
  }
  const orgId = membership.organization_id;
  console.log('Using Org ID:', orgId);

  // 2. Test "New Order" Logic (Clean state)
  console.log('\n--- Testing New Order Logic ---');
  // Create a dummy draft with messages to see if it gets skipped
  const { data: dirtyDraft } = await supabase
    .from('orders')
    .insert({
      organization_id: orgId,
      created_by: userId,
      status: 'draft',
    })
    .select()
    .single();

  if (dirtyDraft) {
    await supabase.from('order_conversations').insert({
      order_id: dirtyDraft.id,
      role: 'user',
      content: 'Test message',
      sequence_number: 0,
    });
    console.log('Created "Dirty" Draft:', dirtyDraft.id);
  }

  // Now simulate the query from new/page.tsx
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { data: recentDraft } = await supabase
    .from('orders')
    .select('id, order_conversations(count)')
    .eq('organization_id', orgId)
    .eq('created_by', userId)
    .eq('status', 'draft')
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log('Recent Draft Found:', recentDraft);

  const hasMessages =
    recentDraft?.order_conversations &&
    Array.isArray(recentDraft.order_conversations) &&
    recentDraft.order_conversations.length > 0 &&
    (recentDraft.order_conversations[0] as { count: number } | undefined)?.count !== undefined &&
    (recentDraft.order_conversations[0] as { count: number }).count > 0;

  console.log('Has Messages:', hasMessages);

  if (recentDraft?.id === dirtyDraft?.id && hasMessages) {
    console.log('✅ Correctly identified dirty draft. Logic would CREATE NEW order.');
  } else if (recentDraft?.id === dirtyDraft?.id && !hasMessages) {
    console.error('❌ FAILED: Identified dirty draft as empty!');
  } else {
    console.log('⚠️ Note: Different draft found or logic mismatch.');
  }

  // 3. Test Persistence & Sequence
  console.log('\n--- Testing Persistence & Sequence ---');
  const { data: freshOrder } = await supabase
    .from('orders')
    .insert({
      organization_id: orgId,
      created_by: userId,
      status: 'draft',
    })
    .select()
    .single();
  console.log('Created Fresh Order:', freshOrder?.id);

  if (freshOrder) {
    // Simulate API saving messages
    const orderId = freshOrder.id;

    // Message 1
    await supabase.from('order_conversations').insert({
      order_id: orderId,
      role: 'user',
      content: 'Message 1',
      sequence_number: 1,
    });

    // Message 2
    await supabase.from('order_conversations').insert({
      order_id: orderId,
      role: 'assistant',
      content: 'Response 1',
      sequence_number: 2,
    });

    // Verify
    const { data: messages } = await supabase
      .from('order_conversations')
      .select('*')
      .eq('order_id', orderId)
      .order('sequence_number');

    console.log('Messages in DB:', messages?.length);
    messages?.forEach(m => console.log(`- [${m.sequence_number}] ${m.role}: ${m.content}`));

    if (
      messages?.length === 2 &&
      messages[0].sequence_number === 1 &&
      messages[1].sequence_number === 2
    ) {
      console.log('✅ Persistence & Sequencing working correctly.');
    } else {
      console.error('❌ Persistence/Sequencing FAILED.');
    }
  }

  console.log('\nVerification Complete.');
}

runVerification();
