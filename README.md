# Office World Cup Predictor

A free office World Cup score prediction portal using:

- Supabase Auth for email/password login
- Supabase Postgres for users, matches, predictions and leaderboard
- Static hosting through GitHub Pages, Netlify or Vercel
- Optional fixture sync from OpenFootball public JSON

## Main features

- Office-only approved user list
- Users create their own passwords
- Users predict match scores
- Predictions lock automatically after kickoff
- Admin can manually lock/unlock matches
- Admin can override and reopen a match even after kickoff
- Admin can sync the World Cup 2026 schedule from the internet
- Admin can enter actual results
- Leaderboard updates automatically

## 1. Supabase setup

1. Create a free Supabase project.
2. Go to **SQL Editor**.
3. Paste and run `supabase-schema.sql`.
4. Before creating your account, add your email as admin:

```sql
insert into public.allowed_users (email, full_name, role)
values ('your-email@office.com', 'Your Name', 'admin');
```

## 2. Get Supabase website keys

Go to **Project Settings > API** and copy:

- Project URL
- anon public key

Never use the service role key in the website.

## 3. Deploy

Upload these files to GitHub:

- `index.html`
- `styles.css`
- `app.js`
- `supabase-schema.sql`
- `README.md`

Then deploy using Netlify, Vercel or GitHub Pages.

## 4. First login

Open the website, paste your Supabase URL and anon key, then create your admin account using the same email you inserted into `allowed_users`.

## 5. Add office users

Run this in Supabase SQL Editor:

```sql
insert into public.allowed_users (email, full_name, role) values
('staff1@office.com', 'Staff One', 'user'),
('staff2@office.com', 'Staff Two', 'user');
```

After that, staff can create their own account in the portal.

## 6. Sync World Cup schedule from internet

In the portal:

1. Login as admin.
2. Open **Admin**.
3. Click **Sync Schedule from Internet**.

Default source:

```text
https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
```

The sync will create or update matches using `external_id`. Existing predictions are preserved.

## 7. Locking rules

Normal rule:

- Users can predict before kickoff.
- Users cannot predict after kickoff.
- If admin ticks **Manual lock**, users cannot predict even before kickoff.

Admin override:

- If admin ticks **Admin override: keep open even after kickoff**, users can submit/update even after kickoff.
- Use this only if you intentionally want to reopen a match.

## 8. Scoring rules

- 5 points: exact score
- 4 points: correct result and correct goal difference
- 3 points: correct winner/draw only
- 0 points: wrong prediction

## 9. Important note about live scores

This version syncs schedule and available score fields from the OpenFootball public JSON. It is best for fixtures and kickoff times. For fully automated live scores, you would need a live sports API. Many live-score APIs require signup, rate limits, or paid tiers.
