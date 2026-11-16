import { supabase } from '@/integrations/supabase/client'

/**
 * Per-day state of an alert's live window (`commute_window_runs`): what was last pushed, whether
 * the rider stopped it, and whether the closing "not live" push already went out. Rows are keyed
 * by (config, date the window opened) so each day starts fresh without any cleanup job.
 */
export const windowRunStore = {
  /** Records the departure lines just pushed for this window. */
  async recordSent(commuteConfigId: string, windowDate: string, body: string): Promise<void> {
    const { error } = await supabase
      .from('commute_window_runs')
      .upsert(
        { commute_config_id: commuteConfigId, window_date: windowDate, last_body: body, last_sent_at: new Date().toISOString() },
        { onConflict: 'commute_config_id,window_date' },
      )

    if (error) throw new Error(`Failed to record window push: ${error.message}`)
  },

  /** Marks the window as closed, so the "not live" push goes out only once. */
  async finalize(commuteConfigId: string, windowDate: string): Promise<void> {
    const { error } = await supabase
      .from('commute_window_runs')
      .update({ finalized: true })
      .eq('commute_config_id', commuteConfigId)
      .eq('window_date', windowDate)

    if (error) throw new Error(`Failed to finalize window: ${error.message}`)
  },

  /** Stops any further pushes for this window (the rider dismissed it or tapped "Stop for today"). */
  async stop(commuteConfigId: string, windowDate: string): Promise<void> {
    const { error } = await supabase
      .from('commute_window_runs')
      .upsert(
        { commute_config_id: commuteConfigId, window_date: windowDate, stopped: true },
        { onConflict: 'commute_config_id,window_date' },
      )

    if (error) throw new Error(`Failed to stop window: ${error.message}`)
  },
}
