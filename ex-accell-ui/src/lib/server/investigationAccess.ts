// Who may change or delete an investigation: the person who created it, or an admin. Rows from before creators were
// recorded have none, and stay editable by any signed-in user rather than becoming locked.

export function canModifyInvestigation(user: { email: string; role?: string } | null | undefined, createdBy: string | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!createdBy) return true;
  return user.email.toLowerCase() === createdBy.toLowerCase();
}
