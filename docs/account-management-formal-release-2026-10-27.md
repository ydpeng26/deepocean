# Approved account management formal release

User approved formal release after recovery acceptance. Published main by non-force
fast-forward from 818d78ff2ba1d1f297266362ec2d4792686d18a9 to
10d8f45f75020674195856bca724e0e828821adb. Application, migration, function and workflow
source match accepted recovery commit 33d441f5dc81f46c8115dc1098fba118ee189e42;
later changes before release were documentation only. No history rewriting.

Formal Supabase project: zmhtlhpeulhhcvlnjdrb. Applied the same
account_deletion_anonymous_forum migration as recovery. Deployed delete-account v1,
id 2c59d20c-b12d-464c-9297-eceb11148861, ACTIVE. Gateway verify_jwt is false because
the handler validates the caller through Auth getUser; no caller-supplied target ID
is accepted. Service credentials stay server-side. Exactly 19 restrictive policies
and 19 writer guards installed. Member and anon cannot execute deletion worker;
service_role can. Jobs table has no member access. No deletion job was started.

Vercel formal project deepocean: Ready Production deployment
7MiAz6Wiisf76QnHBit1vMQNqnrQ, generated domain
deepocean-35p67n7v7-ydpeng26s-projects.vercel.app, source 10d8f45, Current domain
www.supdiver.com. Previous frontend rollback point:
FCYzdafNi9F3Dt7vmy9XiSGzoLrh / source 818d78f. Frontend rollback does not undo
database migrations or restore any future intentionally deleted account.

Verification: actual browser shows formal Ready/current domain/source; unauthenticated
/settings redirects to /auth. Public asset checks confirmed formal backend only,
real settings route/entry, exact deletion confirmation and anonymous-discussion
disclosures. Formal-origin preflight succeeds; missing Auth returns 401; recovery
origin is rejected with 403. Homepage returns 200. First broad asset read timed out;
focused five-file retry passed all checks. Local account-management regression passed.
Recovery destructive acceptance remains run 40450259244, not a formal test.

Formal before/after metadata counts remained users 4, profiles 4, dives 3, gear 2,
forum posts 0, comments 0, Storage objects 15; deletion jobs 0 after release.
No real user account, private record, uploaded image or password was modified.
No formal reset email, account creation or account deletion test was performed.

Security advisor: no new warning from this change. Remaining baseline notices are
existing signed-in definer functions and leaked-password-protection configuration;
private jobs and guest-contact tables intentionally have no client RLS policy.
No unrelated user edits (contact release note or screenlog.0) were staged.
