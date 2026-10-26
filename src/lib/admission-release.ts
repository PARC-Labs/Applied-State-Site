/**
 * Explicit release gate for public membership applications.
 *
 * The review UI and Supabase migration may land before production setup.
 * Keep this false until:
 *   1. migration 0006 has been applied in production;
 *   2. RLS and admission RPC checks have been verified against production;
 *   3. abuse prevention and application retention have been addressed;
 *   4. a full test application and staff review succeed.
 *
 * Changing to true must be a separate reviewed commit.
 */
export const ADMISSION_INTAKE_OPEN = false
