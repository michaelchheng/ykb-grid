// Career Gauntlet — given a stat line, name the player

export interface GauntletQuestion {
  id: string;
  ppg: number;
  rpg?: number;
  apg?: number;
  spg?: number;
  bpg?: number;
  fg_pct?: number;    // as percentage e.g. 56.1
  fg3_pct?: number;   // as percentage e.g. 45.4
  ft_pct?: number;    // as percentage
  season: string;
  conference: string;
  positionHint: string;
  teamHint: string;
  flavor: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Niche';
  answer: string;
  options: [string, string, string, string]; // [correct, wrong, wrong, wrong]
}

export const GAUNTLET_QUESTIONS: GauntletQuestion[] = [
  // ── EASY ──────────────────────────────────────────────────────────────────
  {
    id: 'g_curry_1516',
    ppg: 30.1, rpg: 5.4, apg: 6.7, fg3_pct: 45.4,
    season: '2015-16', conference: 'Western', positionHint: 'Point Guard',
    teamHint: 'Bay Area', difficulty: 'Easy',
    flavor: 'Unanimous MVP. Broke the 3-point record by 116. This is the most identifiable stat line of the decade.',
    answer: 'Stephen Curry',
    options: ['Stephen Curry', 'Klay Thompson', 'Chris Paul', 'Damian Lillard'],
  },
  {
    id: 'g_shaq_0000',
    ppg: 29.7, rpg: 13.6, apg: 3.8, fg_pct: 57.4, bpg: 3.0,
    season: '1999-00', conference: 'Western', positionHint: 'Center',
    teamHint: 'Hollywood', difficulty: 'Easy',
    flavor: 'Finals MVP. Dominated every game by pure will. You don\'t forget a 57.4% FG% from a center averaging 13 boards.',
    answer: 'Shaquille O\'Neal',
    options: ['Shaquille O\'Neal', 'Tim Duncan', 'Hakeem Olajuwon', 'David Robinson'],
  },
  {
    id: 'g_lebron_1213',
    ppg: 26.8, rpg: 8.0, apg: 7.3, spg: 1.9, fg_pct: 56.5,
    season: '2012-13', conference: 'Eastern', positionHint: 'Small Forward',
    teamHint: 'South Beach', difficulty: 'Easy',
    flavor: 'Back-to-back MVP. This is the most efficient LeBron ever was. Near-perfect across every column.',
    answer: 'LeBron James',
    options: ['LeBron James', 'Kevin Durant', 'Dwyane Wade', 'Carmelo Anthony'],
  },
  {
    id: 'g_dirk_1011',
    ppg: 27.7, rpg: 8.0, apg: 2.5, fg_pct: 49.9,
    season: '2010-11', conference: 'Western', positionHint: 'Power Forward',
    teamHint: 'Big D', difficulty: 'Easy',
    flavor: 'Finals MVP. Eliminated the Heat. The right elbow belonged to one man that spring.',
    answer: 'Dirk Nowitzki',
    options: ['Dirk Nowitzki', 'Kevin Durant', 'Pau Gasol', 'Tim Duncan'],
  },
  {
    id: 'g_westbrook_1617',
    ppg: 31.6, rpg: 10.7, apg: 10.4,
    season: '2016-17', conference: 'Western', positionHint: 'Point Guard',
    teamHint: 'Midwest Thunder', difficulty: 'Easy',
    flavor: '42 triple-doubles. First player since Oscar to average a triple-double. This is a historic triple-double line from a franchise player in mourning.',
    answer: 'Russell Westbrook',
    options: ['Russell Westbrook', 'James Harden', 'LeBron James', 'Chris Paul'],
  },

  // ── MEDIUM ────────────────────────────────────────────────────────────────
  {
    id: 'g_cp3_0809',
    ppg: 22.8, rpg: 4.0, apg: 11.0, spg: 2.8,
    season: '2008-09', conference: 'Western', positionHint: 'Point Guard',
    teamHint: 'Bayou Country', difficulty: 'Medium',
    flavor: 'Led the league in steals and assists simultaneously. One of the best point guard seasons ever and it took place in New Orleans.',
    answer: 'Chris Paul',
    options: ['Chris Paul', 'Deron Williams', 'Steve Nash', 'Rajon Rondo'],
  },
  {
    id: 'g_wade_0809',
    ppg: 30.2, rpg: 5.0, apg: 7.5, spg: 2.2,
    season: '2008-09', conference: 'Eastern', positionHint: 'Shooting Guard',
    teamHint: 'South Beach', difficulty: 'Medium',
    flavor: 'Scoring leader. Pre-LeBron Miami Wade was operating at a different level. 30-5-7 with 2 steals is a generational season.',
    answer: 'Dwyane Wade',
    options: ['Dwyane Wade', 'Kobe Bryant', 'LeBron James', 'Joe Johnson'],
  },
  {
    id: 'g_harden_1819',
    ppg: 36.1, rpg: 6.6, apg: 7.5,
    season: '2018-19', conference: 'Western', positionHint: 'Shooting Guard / SF',
    teamHint: 'Space City', difficulty: 'Medium',
    flavor: 'Scored 60+ four times in one month. The most unstoppable offensive season since Wilt. 36 points per game.',
    answer: 'James Harden',
    options: ['James Harden', 'Kevin Durant', 'LeBron James', 'Giannis Antetokounmpo'],
  },
  {
    id: 'g_tmac_0203',
    ppg: 32.1, rpg: 6.5, apg: 5.5, spg: 1.7,
    season: '2002-03', conference: 'Eastern', positionHint: 'Small Forward / SG',
    teamHint: 'Central Florida', difficulty: 'Medium',
    flavor: 'Back-to-back scoring champion. One of the most lethal wing scorers the league has ever seen — and it happened in Orlando.',
    answer: 'Tracy McGrady',
    options: ['Tracy McGrady', 'Kobe Bryant', 'Vince Carter', 'Paul Pierce'],
  },
  {
    id: 'g_iverson_0001',
    ppg: 31.1, rpg: 3.8, apg: 4.7, spg: 2.5,
    season: '2000-01', conference: 'Eastern', positionHint: 'Point Guard / SG',
    teamHint: 'Philly', difficulty: 'Medium',
    flavor: 'MVP. Led the 76ers to the Finals. 6-foot, 165 pounds, 31 points a game. The crossover was just the beginning.',
    answer: 'Allen Iverson',
    options: ['Allen Iverson', 'Kobe Bryant', 'Tracy McGrady', 'Gilbert Arenas'],
  },

  // ── HARD ──────────────────────────────────────────────────────────────────
  {
    id: 'g_arenas_0506',
    ppg: 29.3, rpg: 4.8, apg: 6.1, spg: 1.6,
    season: '2005-06', conference: 'Eastern', positionHint: 'Point Guard',
    teamHint: 'Nation\'s Capital', difficulty: 'Hard',
    flavor: 'Agent Zero. Shot himself into All-NBA discussions with this season in Washington. Still the most underrated 29-point guard season.',
    answer: 'Gilbert Arenas',
    options: ['Gilbert Arenas', 'Dwyane Wade', 'Allen Iverson', 'Baron Davis'],
  },
  {
    id: 'g_brand_0102',
    ppg: 20.1, rpg: 11.1, apg: 1.9, bpg: 2.0, fg_pct: 51.5,
    season: '2001-02', conference: 'Western', positionHint: 'Power Forward',
    teamHint: 'Clippers', difficulty: 'Hard',
    flavor: 'Shared the scoring title with Shaq. From the Clippers. That last part makes this nearly impossible to guess.',
    answer: 'Elton Brand',
    options: ['Elton Brand', 'Tim Duncan', 'Rasheed Wallace', 'Jermaine O\'Neal'],
  },
  {
    id: 'g_pippen_9495',
    ppg: 21.4, rpg: 8.1, apg: 5.2, spg: 2.9, bpg: 1.1,
    season: '1994-95', conference: 'Eastern', positionHint: 'Small Forward',
    teamHint: 'Chicago', difficulty: 'Hard',
    flavor: 'Jordan was gone. He carried the Bulls to 47 wins. This is what elite two-way play looks like in a season that doesn\'t get remembered.',
    answer: 'Scottie Pippen',
    options: ['Scottie Pippen', 'Grant Hill', 'Horace Grant', 'Charles Barkley'],
  },
  {
    id: 'g_odom_0607',
    ppg: 15.4, rpg: 11.2, apg: 3.7, spg: 1.0,
    season: '2006-07', conference: 'Western', positionHint: 'Power Forward / SF',
    teamHint: 'Hollywood', difficulty: 'Hard',
    flavor: 'Sixth Man of the Year — but started for much of this run. The most unique 15-11-3 you\'ll ever see. Could have been anyone.',
    answer: 'Lamar Odom',
    options: ['Lamar Odom', 'Pau Gasol', 'Chris Webber', 'Antawn Jamison'],
  },
  {
    id: 'g_ratliff_9900',
    ppg: 7.8, rpg: 10.5, apg: 1.0, bpg: 3.7, fg_pct: 60.8,
    season: '1999-00', conference: 'Eastern', positionHint: 'Center',
    teamHint: 'Philly', difficulty: 'Hard',
    flavor: 'Led the league in blocks. Best block rate in the league from a backup who became a starter. Deep cut center stat line.',
    answer: 'Theo Ratliff',
    options: ['Theo Ratliff', 'Dikembe Mutombo', 'Alonzo Mourning', 'Ben Wallace'],
  },

  // ── NICHE ─────────────────────────────────────────────────────────────────
  {
    id: 'g_barbosa_0607',
    ppg: 18.1, rpg: 2.8, apg: 3.9, fg_pct: 49.4,
    season: '2006-07', conference: 'Western', positionHint: 'Point Guard',
    teamHint: 'Desert Southwest', difficulty: 'Niche',
    flavor: 'Sixth Man of the Year. The Brazilian Blur. Came off the bench and scored 18 a game in the D\'Antoni system. You\'ve forgotten about him.',
    answer: 'Leandro Barbosa',
    options: ['Leandro Barbosa', 'Jason Terry', 'Manu Ginobili', 'Jamal Crawford'],
  },
  {
    id: 'g_ginobili_0708',
    ppg: 19.5, rpg: 4.6, apg: 4.5, spg: 1.6, fg3_pct: 38.2,
    season: '2007-08', conference: 'Western', positionHint: 'Shooting Guard',
    teamHint: 'San Antonio', difficulty: 'Niche',
    flavor: 'His best statistical season. Off the bench most nights. The one Spur you forget was this good on a per-game basis.',
    answer: 'Manu Ginobili',
    options: ['Manu Ginobili', 'Tony Parker', 'Jamal Crawford', 'Jason Terry'],
  },
  {
    id: 'g_lewis_0708',
    ppg: 18.2, rpg: 5.6, apg: 1.8, fg3_pct: 40.5,
    season: '2007-08', conference: 'Eastern', positionHint: 'Small Forward / PF',
    teamHint: 'Central Florida', difficulty: 'Niche',
    flavor: 'The other star on the Magic during their Finals run. Stretch-4 before it was a term. You don\'t remember him scoring 18 in Orlando.',
    answer: 'Rashard Lewis',
    options: ['Rashard Lewis', 'Hedo Turkoglu', 'Antawn Jamison', 'Peja Stojakovic'],
  },
  {
    id: 'g_camby_0607',
    ppg: 11.5, rpg: 13.1, apg: 1.4, bpg: 3.3,
    season: '2006-07', conference: 'Western', positionHint: 'Center / PF',
    teamHint: 'Rocky Mountains', difficulty: 'Niche',
    flavor: 'Defensive Player of the Year. Led the league in rebounds and blocks from a Denver team nobody talks about anymore.',
    answer: 'Marcus Camby',
    options: ['Marcus Camby', 'Ben Wallace', 'Dikembe Mutombo', 'Brendan Haywood'],
  },
  {
    id: 'g_stackhouse_0102',
    ppg: 23.0, rpg: 3.4, apg: 3.5, spg: 1.2,
    season: '2001-02', conference: 'Eastern', positionHint: 'Shooting Guard',
    teamHint: 'Motor City', difficulty: 'Niche',
    flavor: 'Scored 57 once. One of the most underrated scorers of his era. 23 points a night in Detroit and nobody gave him credit.',
    answer: 'Jerry Stackhouse',
    options: ['Jerry Stackhouse', 'Richard Hamilton', 'Latrell Sprewell', 'Ron Artest'],
  },
];

// Shuffle with seed (same shuffle for same day)
function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

export function getGauntletQuestions(count = 10): GauntletQuestion[] {
  const today = new Date().toISOString().split('T')[0];
  const sorted = [...GAUNTLET_QUESTIONS].sort((a, b) => hashCode(a.id + today) - hashCode(b.id + today));
  // Shuffle options within each question
  return sorted.slice(0, count).map(q => {
    const shuffled = [...q.options].sort(() => Math.random() - 0.5) as [string, string, string, string];
    return { ...q, options: shuffled };
  });
}
