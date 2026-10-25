// The leadership roles in the ward. The names of the people who hold them are entered in Setup
// (see useStaff); everything else that needs to know who is who reads them from there.
// For now every role can see and edit everything; real per-role access comes with logins (Supabase).
export const ROLES = [
  { key: 'bishop', label: 'Bishop' },
  { key: 'first-counselor', label: '1st Counselor' },
  { key: 'second-counselor', label: '2nd Counselor' },
  { key: 'ward-clerk', label: 'Ward Clerk' },
  { key: 'executive-secretary', label: 'Executive Secretary' },
  { key: 'high-councilor', label: 'High Councilor' },
] as const

export type RoleKey = (typeof ROLES)[number]['key']

export const roleLabel = (key: string | null): string | undefined => ROLES.find((r) => r.key === key)?.label
