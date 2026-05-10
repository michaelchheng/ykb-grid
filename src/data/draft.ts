// Draft Order — rank 5 players from highest to lowest by a given stat

export interface DraftPlayer {
  name: string;
  value: number;
  hint?: string; // e.g. team, season context
}

export interface DraftChallenge {
  id: string;
  statLabel: string;         // "Career Points Per Game"
  statUnit: string;          // "PPG", "APG", etc.
  season: string;            // "2015-16 Regular Season" or "Career"
  instruction: string;       // "Rank highest to lowest"
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Niche';
  players: DraftPlayer[];    // already sorted highest→lowest (answer key)
  flavor: string;
}

export const DRAFT_CHALLENGES: DraftChallenge[] = [
  // ── EASY ────────────────────────────────────────────────────────────────
  {
    id: 'd_ppg_2324',
    statLabel: 'Points Per Game',
    statUnit: 'PPG',
    season: '2023-24 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Easy',
    flavor: 'The top scorers from last season. You should know these numbers.',
    players: [
      { name: 'Luka Doncic',               value: 33.9, hint: 'DAL' },
      { name: 'Shai Gilgeous-Alexander',   value: 30.1, hint: 'OKC' },
      { name: 'Giannis Antetokounmpo',     value: 30.4, hint: 'MIL' },
      { name: 'Kevin Durant',              value: 27.1, hint: 'PHX' },
      { name: 'Anthony Edwards',           value: 25.9, hint: 'MIN' },
    ],
  },
  {
    id: 'd_apg_0304',
    statLabel: 'Assists Per Game',
    statUnit: 'APG',
    season: '2003-04 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Easy',
    flavor: 'Classic early-2000s point guard hierarchy. Nash, Kidd, Marbury — how well do you know the exact order?',
    players: [
      { name: 'Jason Kidd',    value: 9.2,  hint: 'NJN' },
      { name: 'Steve Nash',    value: 8.8,  hint: 'DAL' },
      { name: 'Baron Davis',   value: 8.3,  hint: 'NOP' },
      { name: 'Stephon Marbury', value: 7.9, hint: 'NYK' },
      { name: 'Andre Miller', value: 7.1,  hint: 'PHI' },
    ],
  },
  {
    id: 'd_pts_finals_2016',
    statLabel: 'Points Per Game',
    statUnit: 'PPG',
    season: '2016 NBA Finals',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Easy',
    flavor: 'Cavs vs Warriors, seven games, four of the best players in the world. How do their Finals averages stack up?',
    players: [
      { name: 'LeBron James',    value: 29.7, hint: 'CLE' },
      { name: 'Kyrie Irving',    value: 27.1, hint: 'CLE' },
      { name: 'Klay Thompson',   value: 22.6, hint: 'GSW' },
      { name: 'Stephen Curry',   value: 22.6, hint: 'GSW' },
      { name: 'Kevin Love',      value: 12.0, hint: 'CLE' },
    ],
  },

  // ── MEDIUM ──────────────────────────────────────────────────────────────
  {
    id: 'd_rpg_9899',
    statLabel: 'Rebounds Per Game',
    statUnit: 'RPG',
    season: '1998-99 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Medium',
    flavor: 'Lockout-shortened season. The big man hierarchy. Can you sort Rodman, Mutombo, O\'Neal?',
    players: [
      { name: 'Dennis Rodman',      value: 11.2, hint: 'LAL' },
      { name: 'Dikembe Mutombo',    value: 11.5, hint: 'ATL' },
      { name: 'Shaquille O\'Neal',  value: 10.9, hint: 'LAL' },
      { name: 'Jayson Williams',    value: 10.4, hint: 'NJN' },
      { name: 'Antonio Davis',      value: 9.5,  hint: 'TOR' },
    ],
  },
  {
    id: 'd_3pm_1516',
    statLabel: '3-Pointers Made Per Game',
    statUnit: '3PM',
    season: '2015-16 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Medium',
    flavor: 'The year the three-point revolution peaked. Curry set the record. But who was second through fifth?',
    players: [
      { name: 'Stephen Curry',   value: 5.1, hint: 'GSW' },
      { name: 'Klay Thompson',   value: 3.2, hint: 'GSW' },
      { name: 'James Harden',    value: 3.2, hint: 'HOU' },
      { name: 'JJ Redick',       value: 2.5, hint: 'LAC' },
      { name: 'Kyle Lowry',      value: 2.5, hint: 'TOR' },
    ],
  },
  {
    id: 'd_blocks_0809',
    statLabel: 'Blocks Per Game',
    statUnit: 'BPG',
    season: '2008-09 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Medium',
    flavor: 'Shot-blocking dominance. You know Dwight was up there — but who else, and in what order?',
    players: [
      { name: 'Dwight Howard',      value: 2.9, hint: 'ORL' },
      { name: 'Marcus Camby',       value: 2.5, hint: 'LAC' },
      { name: 'Andrew Bogut',       value: 2.0, hint: 'MIL' },
      { name: 'Tim Duncan',         value: 1.8, hint: 'SAS' },
      { name: 'Josh Smith',         value: 1.8, hint: 'ATL' },
    ],
  },
  {
    id: 'd_steals_0203',
    statLabel: 'Steals Per Game',
    statUnit: 'SPG',
    season: '2002-03 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Medium',
    flavor: 'The pickpocket era. Allen Iverson, Ron Artest, and the rest. Who led the league?',
    players: [
      { name: 'Allen Iverson',   value: 2.7, hint: 'PHI' },
      { name: 'Ron Artest',      value: 2.5, hint: 'IND' },
      { name: 'Paul Pierce',     value: 1.9, hint: 'BOS' },
      { name: 'Baron Davis',     value: 1.9, hint: 'NOP' },
      { name: 'Doug Christie',   value: 1.8, hint: 'SAC' },
    ],
  },

  // ── HARD ────────────────────────────────────────────────────────────────
  {
    id: 'd_fg_pct_9900',
    statLabel: 'Field Goal Percentage',
    statUnit: 'FG%',
    season: '1999-00 Regular Season (min. 300 FGA)',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Hard',
    flavor: 'Paint scorers and interior dominance. FG% leaders from Shaq\'s best season. These names require real knowledge.',
    players: [
      { name: 'Shaquille O\'Neal', value: 57.4, hint: 'LAL' },
      { name: 'Theo Ratliff',      value: 60.8, hint: 'PHI' },
      { name: 'Alonzo Mourning',   value: 55.1, hint: 'MIA' },
      { name: 'Chris Gatling',     value: 58.3, hint: 'MIL' },
      { name: 'Raef LaFrentz',     value: 50.9, hint: 'DEN' },
    ],
  },
  {
    id: 'd_ast_pct_1617',
    statLabel: 'Assists Per Game',
    statUnit: 'APG',
    season: '2016-17 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Hard',
    flavor: 'Westbrook averaged a triple-double. But who else was dishing in 2016-17? Sort these five PGs.',
    players: [
      { name: 'Russell Westbrook', value: 10.4, hint: 'OKC' },
      { name: 'James Harden',      value: 11.2, hint: 'HOU' },
      { name: 'Rajon Rondo',       value: 7.8,  hint: 'CHI' },
      { name: 'John Wall',         value: 10.7, hint: 'WAS' },
      { name: 'Ricky Rubio',       value: 9.1,  hint: 'UTA' },
    ],
  },
  {
    id: 'd_bench_pts_1011',
    statLabel: 'Bench Points Per Game',
    statUnit: 'PPG (off bench)',
    season: '2010-11 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Hard',
    flavor: 'Sixth Man territory. These are the best backup scorers of 2010-11. Do you know your role players?',
    players: [
      { name: 'Jamal Crawford',  value: 14.9, hint: 'ATL' },
      { name: 'Lamar Odom',      value: 14.4, hint: 'LAL' },
      { name: 'Manu Ginobili',   value: 13.7, hint: 'SAS' },
      { name: 'Jason Terry',     value: 15.8, hint: 'DAL' },
      { name: 'Lou Williams',    value: 12.2, hint: 'PHI' },
    ],
  },

  // ── NICHE ───────────────────────────────────────────────────────────────
  {
    id: 'd_to_per_game_0405',
    statLabel: 'Turnovers Per Game',
    statUnit: 'TPG',
    season: '2004-05 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Niche',
    flavor: 'Who coughed it up the most? This is a niche category. Stars turn it over, but the order is obscure.',
    players: [
      { name: 'LeBron James',    value: 3.3, hint: 'CLE' },
      { name: 'Steve Nash',      value: 3.0, hint: 'PHX' },
      { name: 'Stephon Marbury', value: 3.3, hint: 'NYK' },
      { name: 'Dwyane Wade',     value: 3.5, hint: 'MIA' },
      { name: 'Paul Pierce',     value: 2.9, hint: 'BOS' },
    ],
  },
  {
    id: 'd_pf_0607',
    statLabel: 'Personal Fouls Per Game',
    statUnit: 'PF',
    season: '2006-07 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Niche',
    flavor: 'Who fouled the most? An absolutely niche category from an era of physical play.',
    players: [
      { name: 'Zaza Pachulia',   value: 3.5, hint: 'ATL' },
      { name: 'Shawn Marion',    value: 2.4, hint: 'PHX' },
      { name: 'Carlos Boozer',   value: 3.1, hint: 'UTA' },
      { name: 'DeSagana Diop',   value: 3.7, hint: 'DAL' },
      { name: 'Brendan Haywood', value: 3.3, hint: 'WAS' },
    ],
  },
  {
    id: 'd_min_0102',
    statLabel: 'Minutes Per Game',
    statUnit: 'MPG',
    season: '2001-02 Regular Season',
    instruction: 'Rank from highest to lowest',
    difficulty: 'Niche',
    flavor: 'Who played the most minutes in 2001-02? Ironmen only. This is a trivia rabbit hole.',
    players: [
      { name: 'Antoine Walker', value: 41.3, hint: 'BOS' },
      { name: 'Baron Davis',    value: 40.7, hint: 'CHA' },
      { name: 'Allen Iverson',  value: 42.5, hint: 'PHI' },
      { name: 'Paul Pierce',    value: 40.3, hint: 'BOS' },
      { name: 'Stephon Marbury', value: 39.8, hint: 'NJN' },
    ],
  },
];

export function getDraftChallenges(count = 8): DraftChallenge[] {
  const shuffled = [...DRAFT_CHALLENGES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
