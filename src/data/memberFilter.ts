import { ROLES, type RoleKey } from './roles'

// "Bishopric" written as an assignee means the bishopric presidency.
const PRESIDENCY: RoleKey[] = ['bishop', 'first-counselor', 'second-counselor']

// Does an item belong to a bishopric member? `assignee` is the free text on an event ("Assigned to") or an
// appointment ("With"). It matches the member's name or their role title, ignoring case, and it can name
// several people ("Bishop Hale, Brother Adams"). `names` maps each role to the name entered in Roles.
export function isAssignedTo(
  role: RoleKey,
  assignee: string | undefined,
  names: Record<string, string>,
): boolean {
  if (!assignee?.trim()) return false
  const title = ROLES.find((r) => r.key === role)?.label.toLowerCase()
  const name = names[role]?.trim().toLowerCase()
  return assignee
    .toLowerCase()
    .split(/,|&|\/|\band\b/)
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => part === title || (!!name && part === name) || (part === 'bishopric' && PRESIDENCY.includes(role)))
}

// The label for a member in the filter: their name with the role title, or just the title until a name is entered.
export function memberLabel(role: RoleKey, names: Record<string, string>): string {
  const title = ROLES.find((r) => r.key === role)?.label ?? role
  const name = names[role]?.trim()
  return name ? `${name} (${title})` : title
}
