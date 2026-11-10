// Who may change or delete something a person created: the creator, or an admin. Rows from before creators were
// recorded have none, and stay editable by any signed-in user rather than becoming locked.

export function canModifyOwned(user: { email: string; role?: string } | null | undefined, createdBy: string | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!createdBy) return true;
  return user.email.toLowerCase() === createdBy.toLowerCase();
}
