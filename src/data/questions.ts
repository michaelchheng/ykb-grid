// YKB — Niche question bank
// Philosophy: dangerously close stats, obscure role players, single-season wonders.
// If you casually know basketball, you should get ~40%. If you are deep, ~70%.

export type Era = 'classic' | 'modern';

export type StatCategory =
  | 'fg_pct' | 'turnovers' | 'missed_free_throws' | 'personal_fouls'
  | 'offensive_rebounds' | 'steals' | 'blocks' | 'assists' | 'points'
  | 'triple_doubles' | 'charges_drawn' | 'ejections' | 'flagrant_fouls'
  | 'air_balls' | 'and1s' | 'buzzer_beaters' | 'fourth_quarter_points'
  | 'bench_points' | 'games_played' | 'three_point_pct' | 'ft_pct';

export interface Player {
  id: string;
  name: string;
  context: string;
  teamColor: string;
}

export interface Question {
  id: string;
  era: Era;
  category: StatCategory;
  label: string;
  subLabel: string;
  flavor: string;
  playerA: Player;
  playerB: Player;
  valueA: number;
  valueB: number;
  unit: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'niche';
}

const P = (id: string, name: string, context: string, teamColor: string): Player =>
  ({ id, name, context, teamColor });

// Modern stars
const shai     = P('shai',     'Shai Gilgeous-Alexander', 'OKC 2024-25',  '#007AC1');
const luka     = P('luka',     'Luka Doncic',             'DAL 2024-25',  '#00538C');
const jokic    = P('jokic',    'Nikola Jokic',            'DEN 2024-25',  '#0E2240');
const giannis  = P('giannis',  'Giannis Antetokounmpo',   'MIL 2024-25',  '#00471B');
const tatum    = P('tatum',    'Jayson Tatum',            'BOS 2024-25',  '#007A33');
const lebron   = P('lebron',   'LeBron James',            'LAL 2024-25',  '#552583');
const embiid   = P('embiid',   'Joel Embiid',             'PHI 2024-25',  '#006BB6');
const ant      = P('ant',      'Anthony Edwards',         'MIN 2024-25',  '#236192');
const wemby    = P('wemby',    'Victor Wembanyama',       'SAS 2024-25',  '#C4CED4');
const hali     = P('hali',     'Tyrese Haliburton',       'IND 2024-25',  '#002D62');
const bam      = P('bam',      'Bam Adebayo',             'MIA 2024-25',  '#98002E');
const fox      = P('fox',      "De'Aaron Fox",            'SAC 2024-25',  '#5A2D81');
const jjj      = P('jjj',      'Jaren Jackson Jr.',       'MEM 2024-25',  '#5D76A9');
const sabonis  = P('sabonis',  'Domantas Sabonis',        'SAC 2024-25',  '#5A2D81');
const booker   = P('booker',   'Devin Booker',            'PHX 2024-25',  '#E56020');
const brunson  = P('brunson',  'Jalen Brunson',           'NYK 2024-25',  '#006BB6');
const durant   = P('durant',   'Kevin Durant',            'PHX 2024-25',  '#1D1160');

// Modern role players
const nunn     = P('nunn',     'Kendrick Nunn',           'LAL 2021-22',  '#552583');
const bullock  = P('bullock',  'Reggie Bullock',          'NYK 2020-21',  '#006BB6');
const neto     = P('neto',     'Raul Neto',               'WSH 2020-21',  '#E31837');
const frye     = P('frye',     'Channing Frye',           'LAL 2017-18',  '#552583');
const faried   = P('faried',   'Kenneth Faried',          'DEN 2013-14',  '#0E2240');
const burks    = P('burks',    'Alec Burks',              'CLE 2018-19',  '#860038');
const oubre    = P('oubre',    'Kelly Oubre Jr.',         'GSW 2019-20',  '#1D428A');
const pat_bev  = P('pat_bev',  'Patrick Beverley',        'LAC 2017-18',  '#C8102E');
const theis    = P('theis',    'Daniel Theis',            'BOS 2019-20',  '#007A33');
const temple   = P('temple',   'Garrett Temple',          'NOP 2019-20',  '#0C2340');
const nance    = P('nance',    'Larry Nance Jr.',         'CLE 2018-19',  '#860038');
const harkless = P('harkless', 'Maurice Harkless',        'POR 2017-18',  '#E03A3E');
const crabbe   = P('crabbe',   'Allen Crabbe',            'BKN 2017-18',  '#777D84');
const dekker   = P('dekker',   'Sam Dekker',              'HOU 2016-17',  '#CE1141');

// Classic stars
const jordan   = P('jordan',   'Michael Jordan',          'CHI 1987-88',  '#CE1141');
const magic    = P('magic',    'Magic Johnson',           'LAL 1986-87',  '#552583');
const bird     = P('bird',     'Larry Bird',              'BOS 1986-87',  '#007A33');
const shaq     = P('shaq',     'Shaquille ONeal',         'LAL 2000-01',  '#552583');
const kobe     = P('kobe',     'Kobe Bryant',             'LAL 2005-06',  '#552583');
const hakeem   = P('hakeem',   'Hakeem Olajuwon',         'HOU 1989-90',  '#CE1141');
const stockton = P('stockton', 'John Stockton',           'UTA 1989-90',  '#002B5C');
const rodman   = P('rodman',   'Dennis Rodman',           'DET 1991-92',  '#C8102E');
const drexler  = P('drexler',  'Clyde Drexler',           'POR 1987-88',  '#E03A3E');
const malone_k = P('malone_k', 'Karl Malone',             'UTA 1997-98',  '#002B5C');
const mutombo  = P('mutombo',  'Dikembe Mutombo',         'ATL 1996-97',  '#C8102E');
const barkley  = P('barkley',  'Charles Barkley',         'PHI 1987-88',  '#006BB6');
const isiah    = P('isiah',    'Isiah Thomas',            'DET 1984-85',  '#C8102E');
const payton_g = P('payton_g', 'Gary Payton',             'SEA 1995-96',  '#00653A');
const tmac     = P('tmac',     'Tracy McGrady',           'ORL 2002-03',  '#007DC5');
const russ     = P('russ',     'Russell Westbrook',       'OKC 2016-17',  '#007AC1');
const harden   = P('harden',   'James Harden',            'HOU 2016-17',  '#CE1141');
const wade     = P('wade',     'Dwyane Wade',             'MIA 2005-06',  '#98002E');
const dirk     = P('dirk',     'Dirk Nowitzki',           'DAL 2010-11',  '#00538C');
const nash     = P('nash',     'Steve Nash',              'PHX 2004-05',  '#E56020');
const melo     = P('melo',     'Carmelo Anthony',         'NYK 2012-13',  '#006BB6');

// Classic role players
const sedale   = P('sedale',   'Sedale Threatt',          'SEA 1992-93',  '#00653A');
const blue_e   = P('blue_e',   'Blue Edwards',            'UTA 1990-91',  '#002B5C');
const bob_h    = P('bob_h',    'Bob Hansen',              'UTA 1988-89',  '#002B5C');
const felton   = P('felton',   'Raymond Felton',          'NYK 2012-13',  '#006BB6');
const duhon    = P('duhon',    'Chris Duhon',             'NYK 2008-09',  '#006BB6');
const foyle    = P('foyle',    'Adonal Foyle',            'GSW 2000-01',  '#1D428A');
const longley  = P('longley',  'Luc Longley',             'CHI 1996-97',  '#CE1141');
const caffey   = P('caffey',   'Jason Caffey',            'CHI 1996-97',  '#CE1141');
const hoiberg  = P('hoiberg',  'Fred Hoiberg',            'IND 1999-00',  '#002D62');
const greg_o   = P('greg_o',   'Greg Ostertag',           'UTA 1997-98',  '#002B5C');
const perkins  = P('perkins',  'Kendrick Perkins',        'BOS 2008-09',  '#007A33');
const z_mo     = P('z_mo',     'Zeljko Rebraca',          'DET 2001-02',  '#C8102E');
const chris_m  = P('chris_m',  'Chris Morris',            'NJN 1990-91',  '#777D84');


// Additional players for expanded question bank
const giannis2  = P('giannis2',  'Giannis Antetokounmpo',   'MIL 2019-20',  '#00471B');
const curry      = P('curry',     'Stephen Curry',           'GSW 2015-16',  '#1D428A');
const kd_gsw     = P('kd_gsw',    'Kevin Durant',            'GSW 2017-18',  '#1D428A');
const cp3        = P('cp3',       'Chris Paul',              'HOU 2018-19',  '#CE1141');
const kawhi      = P('kawhi',     'Kawhi Leonard',           'TOR 2018-19',  '#CE1141');
const dame       = P('dame',      'Damian Lillard',          'POR 2020-21',  '#E03A3E');
const pg13       = P('pg13',      'Paul George',             'OKC 2018-19',  '#007AC1');
const klay_gsw   = P('klay_gsw',  'Klay Thompson',           'GSW 2018-19',  '#1D428A');
const d_rose     = P('d_rose',    'Derrick Rose',            'CHI 2010-11',  '#CE1141');
const westbrook  = P('westbrook', 'Russell Westbrook',       'OKC 2016-17',  '#007AC1');
const russ_wsh   = P('russ_wsh',  'Russell Westbrook',       'WSH 2020-21',  '#E31837');
const kobe06     = P('kobe06',    'Kobe Bryant',             'LAL 2005-06',  '#552583');
const ai         = P('ai',        'Allen Iverson',           'PHI 2005-06',  '#006BB6');
const tmac_hou   = P('tmac_hou',  'Tracy McGrady',           'HOU 2004-05',  '#CE1141');
const bron_lbj   = P('bron_lbj',  'LeBron James',            'CLE 2009-10',  '#860038');
const bron_heat  = P('bron_heat', 'LeBron James',            'MIA 2012-13',  '#98002E');
const dwade      = P('dwade',     'Dwyane Wade',             'MIA 2008-09',  '#98002E');
const cp3_phx    = P('cp3_phx',   'Chris Paul',              'PHX 2020-21',  '#E56020');
const joker_mv3  = P('joker_mv3', 'Nikola Jokic',            'DEN 2021-22',  '#0E2240');
const luka_dal   = P('luka_dal',  'Luka Doncic',             'DAL 2022-23',  '#00538C');
const shai_okc   = P('shai_okc',  'Shai Gilgeous-Alexander', 'OKC 2023-24',  '#007AC1');
const trae       = P('trae',      'Trae Young',              'ATL 2021-22',  '#C1D32F');
const cj_mccol   = P('cj_mccol',  'CJ McCollum',            'POR 2015-16',  '#E03A3E');
const kyrie      = P('kyrie',     'Kyrie Irving',            'CLE 2015-16',  '#860038');
const schroder   = P('schroder', 'Dennis Schroder',          'OKC 2019-20',  '#007AC1');
const rubio      = P('rubio',     'Ricky Rubio',             'UTA 2016-17',  '#002B5C');
const gobert     = P('gobert',    'Rudy Gobert',             'UTA 2018-19',  '#002B5C');
const ad         = P('ad',        'Anthony Davis',           'LAL 2020-21',  '#552583');
const whiteside  = P('whiteside', 'Hassan Whiteside',        'MIA 2015-16',  '#98002E');
const drummond   = P('drummond',  'Andre Drummond',          'DET 2017-18',  '#C8102E');
const vucevic    = P('vucevic',   'Nikola Vucevic',          'ORL 2018-19',  '#0077C0');
const capela    = P('capela',    'Clint Capela',             'HOU 2018-19',  '#CE1141');
const porzingis = P('porzingis', 'Kristaps Porzingis',       'NYK 2017-18',  '#006BB6');
const simmons   = P('simmons',   'Ben Simmons',              'PHI 2019-20',  '#006BB6');
const beal      = P('beal',      'Bradley Beal',             'WSH 2020-21',  '#E31837');
const middleton = P('middleton', 'Khris Middleton',          'MIL 2020-21',  '#00471B');
const lavine    = P('lavine',    'Zach LaVine',              'CHI 2021-22',  '#CE1141');
const ingram    = P('ingram',    'Brandon Ingram',           'NOP 2019-20',  '#0C2340');
const zion      = P('zion',      'Zion Williamson',          'NOP 2021-22',  '#0C2340');
export const QUESTIONS: Question[] = [

  // MODERN: dangerously close FG%
  { id: 'q_fg_nunn_bullock', era: 'modern', category: 'fg_pct', label: 'Field Goal %', subLabel: '2020-21 regular season', flavor: 'Nunn shot 43.8%, Bullock 43.6%. A 0.2 point difference. If you guessed correctly you need help.', playerA: nunn, playerB: bullock, valueA: 438, valueB: 436, unit: 'FG% x1000', difficulty: 'niche' },
  { id: 'q_fg_oubre_burks', era: 'modern', category: 'fg_pct', label: 'Field Goal %', subLabel: '2019-20 regular season', flavor: 'Oubre at 44.3% vs Burks at 44.1%. Two volume shooters on rebuilding teams.', playerA: oubre, playerB: burks, valueA: 443, valueB: 441, unit: 'FG% x1000', difficulty: 'niche' },
  { id: 'q_fg_pat_bev_temple', era: 'modern', category: 'fg_pct', label: 'Field Goal %', subLabel: '2019-20 regular season', flavor: 'Defensive specialists forced to shoot. Neither should be taking many attempts.', playerA: pat_bev, playerB: temple, valueA: 402, valueB: 398, unit: 'FG% x1000', difficulty: 'niche' },
  { id: 'q_3pt_crabbe_harkless', era: 'modern', category: 'three_point_pct', label: '3-Point %', subLabel: '2017-18 regular season', flavor: 'Crabbe shot 37.2% from three, Harkless 37.0%. Both on max-adjacent deals. Both overpaid.', playerA: crabbe, playerB: harkless, valueA: 372, valueB: 370, unit: '3P% x1000', difficulty: 'niche' },
  { id: 'q_ft_theis_nance', era: 'modern', category: 'ft_pct', label: 'Free Throw %', subLabel: '2019-20 regular season', flavor: 'Interior bigs who can actually make free throws. A niche demographic.', playerA: theis, playerB: nance, valueA: 789, valueB: 782, unit: 'FT% x1000', difficulty: 'niche' },
  { id: 'q_fg_booker_brunson', era: 'modern', category: 'fg_pct', label: 'Field Goal %', subLabel: '2024-25 regular season', flavor: 'Booker at 48.3% is elite for a volume wing. Brunson at 47.1% is right behind him.', playerA: booker, playerB: brunson, valueA: 483, valueB: 471, unit: 'FG% x1000', difficulty: 'hard' },

  // MODERN: role player curiosities
  { id: 'q_tov_dekker_neto', era: 'modern', category: 'turnovers', label: 'Season Turnovers', subLabel: '2016-17 regular season', flavor: 'Dekker had 61 turnovers as a backup in Houston. Neto had 56 in Utah. Neither played 30 minutes.', playerA: dekker, playerB: neto, valueA: 61, valueB: 56, unit: 'turnovers', difficulty: 'hard' },
  { id: 'q_oreb_faried_frye', era: 'modern', category: 'offensive_rebounds', label: 'Offensive Rebounds', subLabel: '2013-14 regular season', flavor: 'Faried was a relentless offensive rebounder. Frye is an unironic answer here with 35.', playerA: faried, playerB: frye, valueA: 241, valueB: 35, unit: 'offensive rebounds', difficulty: 'easy' },
  { id: 'q_pf_pat_bev_crabbe', era: 'modern', category: 'personal_fouls', label: 'Personal Fouls', subLabel: '2017-18 regular season', flavor: 'Beverley fouled 185 times that season. He is built different.', playerA: pat_bev, playerB: crabbe, valueA: 185, valueB: 61, unit: 'fouls', difficulty: 'easy' },
  { id: 'q_charges_bam_jjj', era: 'modern', category: 'charges_drawn', label: 'Charges Drawn', subLabel: '2024-25 regular season', flavor: 'Bam sets his feet better than anyone in the paint. Jackson is long but does not sacrifice his body like that.', playerA: bam, playerB: jjj, valueA: 28, valueB: 11, unit: 'charges drawn', difficulty: 'hard' },

  // MODERN: stars, niche angles
  { id: 'q_tov_luka_jokic', era: 'modern', category: 'turnovers', label: 'Season Turnovers', subLabel: '2024-25 regular season', flavor: 'Luka led the league in turnovers for the third straight year. Jokic turns it over efficiently.', playerA: luka, playerB: jokic, valueA: 342, valueB: 287, unit: 'turnovers', difficulty: 'medium' },
  { id: 'q_mft_giannis_embiid', era: 'modern', category: 'missed_free_throws', label: 'Missed Free Throws', subLabel: '2024-25 regular season', flavor: 'Giannis gets to the line 11 times per game and still misses this many. Embiid played 20 fewer games.', playerA: giannis, playerB: embiid, valueA: 181, valueB: 112, unit: 'missed FTs', difficulty: 'medium' },
  { id: 'q_blk_wemby_jjj', era: 'modern', category: 'blocks', label: 'Season Blocks', subLabel: '2024-25 regular season', flavor: 'Wemby averaged 3.6 blocks per game. Jackson Jr. averaged 2.9. Both are generational shot-blockers.', playerA: wemby, playerB: jjj, valueA: 295, valueB: 238, unit: 'blocks', difficulty: 'medium' },
  { id: 'q_ast_hali_sabonis', era: 'modern', category: 'assists', label: 'Season Assists', subLabel: '2024-25 regular season', flavor: 'Two of the most underrated playmakers in basketball. Haliburton runs an orchestra. Sabonis does it from the post.', playerA: hali, playerB: sabonis, valueA: 721, valueB: 604, unit: 'assists', difficulty: 'hard' },
  { id: 'q_stl_fox_shai', era: 'modern', category: 'steals', label: 'Season Steals', subLabel: '2024-25 regular season', flavor: 'Fox leads the league most years. Shai is quiet on defense but sneaky active with his hands.', playerA: fox, playerB: shai, valueA: 171, valueB: 118, unit: 'steals', difficulty: 'medium' },
  { id: 'q_td_jokic_sabonis', era: 'modern', category: 'triple_doubles', label: 'Triple-Doubles', subLabel: '2024-25 regular season', flavor: 'Sabonis had 19 triple-doubles while barely getting attention nationally. Jokic had 24.', playerA: jokic, playerB: sabonis, valueA: 24, valueB: 19, unit: 'triple-doubles', difficulty: 'medium' },
  { id: 'q_q4pts_shai_tatum', era: 'modern', category: 'fourth_quarter_points', label: '4th Quarter Points', subLabel: '2024-25 regular season', flavor: 'Shai is the most reliable fourth quarter scorer in basketball right now.', playerA: shai, playerB: tatum, valueA: 412, valueB: 389, unit: 'Q4 points', difficulty: 'hard' },
  { id: 'q_eject_lebron_durant', era: 'modern', category: 'ejections', label: 'Career Ejections', subLabel: 'All-time NBA career', flavor: 'LeBron has two career ejections across 22 seasons. Durant has four.', playerA: lebron, playerB: durant, valueA: 2, valueB: 4, unit: 'ejections', difficulty: 'hard' },
  { id: 'q_pf_ant_giannis', era: 'modern', category: 'personal_fouls', label: 'Personal Fouls', subLabel: '2024-25 regular season', flavor: 'Both attack the rim at full speed. Giannis fouled out 9 times. Edwards twice.', playerA: ant, playerB: giannis, valueA: 164, valueB: 198, unit: 'personal fouls', difficulty: 'medium' },

  // CLASSIC: star deep cuts
  { id: 'q_ast_isiah_magic', era: 'classic', category: 'assists', label: 'Season Assists', subLabel: '1984-85 regular season', flavor: 'Isiah Thomas dropped 1,123 assists in 1984-85, 13.9 per game, outpacing Magic that year. One of the most forgotten stat lines in NBA history.', playerA: isiah, playerB: magic, valueA: 1123, valueB: 968, unit: 'assists', difficulty: 'niche' },
  { id: 'q_ast_stockton_magic', era: 'classic', category: 'assists', label: 'Single-Season Assists Record', subLabel: '1989-90 regular season', flavor: 'Stockton set the all-time single-season record with 1,134 assists in 1989-90. The most underrated point guard of all time.', playerA: stockton, playerB: magic, valueA: 1134, valueB: 875, unit: 'assists', difficulty: 'medium' },
  { id: 'q_stl_jordan_drexler', era: 'classic', category: 'steals', label: 'Season Steals', subLabel: '1987-88 regular season', flavor: 'Jordan averaged 3.16 steals per game in 1987-88. One of only two players ever to average 3+ in a season.', playerA: jordan, playerB: drexler, valueA: 259, valueB: 194, unit: 'steals', difficulty: 'medium' },
  { id: 'q_oreb_rodman_barkley', era: 'classic', category: 'offensive_rebounds', label: 'Offensive Rebounds', subLabel: '1991-92 regular season', flavor: 'Rodman had 523 offensive rebounds in 1991-92. A number so absurd it barely seems real.', playerA: rodman, playerB: barkley, valueA: 523, valueB: 366, unit: 'offensive rebounds', difficulty: 'hard' },
  { id: 'q_mft_shaq_mutombo00', era: 'classic', category: 'missed_free_throws', label: 'Missed Free Throws', subLabel: '2000-01 regular season', flavor: 'Shaq attempted 972 free throws, made 591, missed 381. He was still the best player in basketball.', playerA: shaq, playerB: mutombo, valueA: 381, valueB: 97, unit: 'missed FTs', difficulty: 'easy' },
  { id: 'q_blk_hakeem_mutombo', era: 'classic', category: 'blocks', label: 'Season Blocks', subLabel: 'Best single season', flavor: 'Hakeem averaged 4.59 blocks per game in 1989-90. Mutombo had 321 at his peak. Both finger-wagged their way into history.', playerA: hakeem, playerB: mutombo, valueA: 376, valueB: 321, unit: 'blocks', difficulty: 'niche' },
  { id: 'q_stl_payton_malone', era: 'classic', category: 'steals', label: 'Season Steals', subLabel: '1995-96 regular season', flavor: 'Gary Payton won DPOY in 1995-96 averaging 2.85 steals per game. Malone had 98. The Glove ate.', playerA: payton_g, playerB: malone_k, valueA: 231, valueB: 98, unit: 'steals', difficulty: 'medium' },
  { id: 'q_ast_magic_bird', era: 'classic', category: 'assists', label: 'Season Assists', subLabel: '1986-87 regular season', flavor: "Magic averaged 12.2 assists per game to Bird's 7.6. The rivalry was equal everywhere except at the point guard position.", playerA: magic, playerB: bird, valueA: 977, valueB: 608, unit: 'assists', difficulty: 'easy' },
  { id: 'q_td_russ_harden', era: 'classic', category: 'triple_doubles', label: 'Triple-Doubles', subLabel: '2016-17 regular season', flavor: 'Westbrook averaged a triple-double for the full season with 42. The first player to do it since Oscar Robertson.', playerA: russ, playerB: harden, valueA: 42, valueB: 21, unit: 'triple-doubles', difficulty: 'easy' },
  { id: 'q_tov_harden_russ', era: 'classic', category: 'turnovers', label: 'Season Turnovers', subLabel: '2016-17 regular season', flavor: 'Westbrook averaged 5.4 turnovers per game, a record for guards, while averaging a triple-double. Pure chaos.', playerA: harden, playerB: russ, valueA: 356, valueB: 438, unit: 'turnovers', difficulty: 'hard' },
  { id: 'q_pts_tmac_kobe', era: 'classic', category: 'points', label: 'Season Points', subLabel: '2002-03 regular season', flavor: 'McGrady averaged 32.1 ppg in 2002-03, barely edging Kobe. One generation forgot how unguardable McGrady was before his back collapsed.', playerA: tmac, playerB: kobe, valueA: 2407, valueB: 2461, unit: 'points', difficulty: 'niche' },
  { id: 'q_ast_nash_wade', era: 'classic', category: 'assists', label: 'Season Assists', subLabel: '2004-05 regular season', flavor: 'Nash won MVP running 7-seconds-or-less with 861 assists. Wade was the engine in Miami but Nash was in a different register as a passer.', playerA: nash, playerB: wade, valueA: 861, valueB: 520, unit: 'assists', difficulty: 'medium' },
  { id: 'q_pts_melo_dirk', era: 'classic', category: 'points', label: 'Career Points Through Age 34', subLabel: 'All-time career', flavor: 'Dirk had 24,316 points through his age-34 season. Melo had 24,559. Neck and neck.', playerA: melo, playerB: dirk, valueA: 24559, valueB: 24316, unit: 'career points', difficulty: 'niche' },

  // CLASSIC: obscure role player niche
  { id: 'q_fg_sedale_blue', era: 'classic', category: 'fg_pct', label: 'Field Goal %', subLabel: '1990-91 regular season', flavor: 'Sedale Threatt shot 45.8% for Seattle. Blue Edwards shot 45.5% for Utah. Two names you absolutely should not know.', playerA: sedale, playerB: blue_e, valueA: 458, valueB: 455, unit: 'FG% x1000', difficulty: 'niche' },
  { id: 'q_pf_foyle_longley', era: 'classic', category: 'personal_fouls', label: 'Personal Fouls', subLabel: '1999-00 regular season', flavor: 'Adonal Foyle fouled 212 times in 1999-00. He averaged a foul every 7 minutes for his career.', playerA: foyle, playerB: longley, valueA: 212, valueB: 148, unit: 'personal fouls', difficulty: 'hard' },
  { id: 'q_ft_greg_o_perkins', era: 'classic', category: 'ft_pct', label: 'Free Throw % (season worst)', subLabel: 'Career worst seasons', flavor: 'Greg Ostertag shot 53.4% from the line for Utah. Perkins shot 55.4% for Boston. Both were starters on championship-caliber teams.', playerA: greg_o, playerB: perkins, valueA: 534, valueB: 554, unit: 'FT% x1000', difficulty: 'hard' },
  { id: 'q_blk_foyle_z_mo', era: 'classic', category: 'blocks', label: 'Season Blocks', subLabel: '2001-02 regular season', flavor: 'Adonal Foyle had 163 blocks in 2001-02 from the bench in Golden State. Rebraca had 71 as a backup in Detroit.', playerA: foyle, playerB: z_mo, valueA: 163, valueB: 71, unit: 'blocks', difficulty: 'niche' },
  { id: 'q_ast_duhon_felton', era: 'classic', category: 'assists', label: 'Season Assists', subLabel: '2008-09 regular season', flavor: 'Chris Duhon had 868 assists as the Knicks starter. Raymond Felton had 612. Neither team went anywhere.', playerA: duhon, playerB: felton, valueA: 868, valueB: 612, unit: 'assists', difficulty: 'hard' },
  { id: 'q_gp_hoiberg_bob_h', era: 'classic', category: 'games_played', label: 'Career Games Played', subLabel: 'NBA career totals', flavor: 'Fred Hoiberg played 393 NBA games. Bob Hansen played 388. Two names every fan knows only because of coaching or family.', playerA: hoiberg, playerB: bob_h, valueA: 393, valueB: 388, unit: 'games played', difficulty: 'niche' },
  { id: 'q_pf_caffey_chris_m', era: 'classic', category: 'personal_fouls', label: 'Personal Fouls', subLabel: '1996-97 regular season', flavor: 'Jason Caffey had 187 fouls on the Bulls dynasty. Chris Morris fouled 201 times in New Jersey the same year.', playerA: caffey, playerB: chris_m, valueA: 187, valueB: 201, unit: 'personal fouls', difficulty: 'niche' },

  // EXTRA NICHE — microscopic gaps
  { id: 'q_fg_nunn_hill', era: 'modern', category: 'fg_pct', label: 'Field Goal %', subLabel: '2021-22 regular season', flavor: 'Nunn shot 44.1%, Hill shot 44.0%. One tenth of a percent. Both are rotation players nobody discusses.', playerA: nunn, playerB: frye, valueA: 441, valueB: 440, unit: 'FG% x1000', difficulty: 'niche' },
  { id: 'q_3pt_burks_neto2', era: 'modern', category: 'three_point_pct', label: '3-Point %', subLabel: '2018-19 regular season', flavor: 'Burks shot 35.1%, Neto shot 35.0%. Two backup guards nobody picked in fantasy.', playerA: burks, playerB: neto, valueA: 351, valueB: 350, unit: '3P% x1000', difficulty: 'niche' },
  { id: 'q_ast_sedale_blue2', era: 'classic', category: 'assists', label: 'Season Assists', subLabel: '1991-92 regular season', flavor: 'Sedale Threatt had 394 assists running Seattle. Blue Edwards had 179 in Utah. The gap is real but do you know the number?', playerA: sedale, playerB: blue_e, valueA: 394, valueB: 179, unit: 'assists', difficulty: 'hard' },
  { id: 'q_pf_hoiberg_bob_h2', era: 'classic', category: 'personal_fouls', label: 'Career Personal Fouls', subLabel: 'NBA career totals', flavor: 'Fred Hoiberg fouled 527 times. Bob Hansen fouled 508. Neither was known for being physical.', playerA: hoiberg, playerB: bob_h, valueA: 527, valueB: 508, unit: 'career fouls', difficulty: 'niche' },
  { id: 'q_ft_greg_theis', era: 'modern', category: 'ft_pct', label: 'Free Throw %', subLabel: '2020-21 regular season', flavor: 'Theis shot 79.3%, Nance shot 77.5%. Two bigs who can actually make free throws. Somehow this is niche.', playerA: theis, playerB: nance, valueA: 793, valueB: 775, unit: 'FT% x1000', difficulty: 'niche' },
  { id: 'q_blk_wemby2', era: 'modern', category: 'blocks', label: 'Season Blocks', subLabel: '2023-24 regular season', flavor: 'Wemby had 254 blocks as a rookie. No one since Olajuwon in 1989 has blocked that many.', playerA: wemby, playerB: jjj, valueA: 254, valueB: 196, unit: 'blocks', difficulty: 'medium' },
  // ── THRESHOLD GAMES ──────────────────────────────────────────────────────
  { id: 'q_30pt_kobe_ai', era: 'classic', category: 'points', label: '30-Point Games', subLabel: '2005-06 regular season', flavor: 'Kobe scored 30+ in 45 games on his way to 81 points. Iverson had 35 — also elite, also forgotten next to Kobe that year.', playerA: kobe06, playerB: ai, valueA: 45, valueB: 35, unit: '30-pt games', difficulty: 'medium' },
  { id: 'q_30pt_harden_westbrook', era: 'modern', category: 'points', label: '30-Point Games', subLabel: '2018-19 regular season', flavor: 'Harden had 43 games with 30+ that season, a modern record. Westbrook had 21 — which feels like a lot until you compare.', playerA: harden, playerB: westbrook, valueA: 43, valueB: 21, unit: '30-pt games', difficulty: 'medium' },
  { id: 'q_40pt_kobe_tmac', era: 'classic', category: 'points', label: '40-Point Games', subLabel: '2002-03 regular season', flavor: 'McGrady and Kobe traded the scoring title back and forth. Both had 11 games over 40 that year. One of them is correct.', playerA: kobe06, playerB: tmac_hou, valueA: 9, valueB: 11, unit: '40-pt games', difficulty: 'hard' },
  { id: 'q_dd_westbrook_bron', era: 'modern', category: 'triple_doubles', label: 'Double-Double Games', subLabel: '2016-17 regular season', flavor: 'Westbrook had 68 double-double games while chasing Oscar. LeBron had 38 in his standard excellent season.', playerA: westbrook, playerB: bron_lbj, valueA: 68, valueB: 38, unit: 'double-doubles', difficulty: 'easy' },
  { id: 'q_10ast_russ_cp3', era: 'modern', category: 'assists', label: '10-Assist Games', subLabel: '2016-17 regular season', flavor: 'Westbrook had 51 games with 10+ assists that year. CP3 had 29 — elite for a true point guard in a half-court system.', playerA: westbrook, playerB: cp3, valueA: 51, valueB: 29, unit: '10-ast games', difficulty: 'medium' },
  { id: 'q_10ast_harden_luka', era: 'modern', category: 'assists', label: '10-Assist Games', subLabel: '2019-20 regular season', flavor: 'Harden ran the offense and had 25 games with 10+ dimes. Luka had 21 as a 20-year-old — basically the same tier.', playerA: harden, playerB: luka_dal, valueA: 25, valueB: 21, unit: '10-ast games', difficulty: 'hard' },
  { id: 'q_15reb_drummond_gobert', era: 'modern', category: 'offensive_rebounds', label: '15-Rebound Games', subLabel: '2017-18 regular season', flavor: 'Drummond had 14 games with 15+ boards. Gobert had 8. Both were generational rebounders with very different methods.', playerA: drummond, playerB: gobert, valueA: 14, valueB: 8, unit: '15-reb games', difficulty: 'hard' },

  // ── CLUTCH / SITUATIONAL ─────────────────────────────────────────────────
  { id: 'q_clutch_shai_luka', era: 'modern', category: 'fourth_quarter_points', label: 'Clutch Points', subLabel: '2023-24 regular season (last 5 min, within 5 pts)', flavor: 'Shai led the league in clutch scoring with 98 points. Luka had 91 — two of the most reliable closers in basketball.', playerA: shai_okc, playerB: luka_dal, valueA: 98, valueB: 91, unit: 'clutch pts', difficulty: 'hard' },
  { id: 'q_q4_dame_kyrie', era: 'modern', category: 'fourth_quarter_points', label: '4th Quarter Points', subLabel: '2020-21 regular season', flavor: 'Dame scored 312 fourth-quarter points — he plays his best basketball when the game means most. Kyrie had 268.', playerA: dame, playerB: kyrie, valueA: 312, valueB: 268, unit: 'Q4 points', difficulty: 'medium' },

  // ── THREE-POINT DEEP CUTS ─────────────────────────────────────────────────
  { id: 'q_3pm_curry_klay', era: 'modern', category: 'three_point_pct', label: 'Three-Pointers Made', subLabel: '2015-16 regular season', flavor: 'Curry made 402 threes, shattering his own record. Klay made 276. Both on the same team, both all-time great shooters, not even close.', playerA: curry, playerB: klay_gsw, valueA: 402, valueB: 276, unit: 'threes made', difficulty: 'easy' },
  { id: 'q_3pm_harden_dame', era: 'modern', category: 'three_point_pct', label: 'Three-Pointers Made', subLabel: '2018-19 regular season', flavor: 'Harden made 378 threes off the dribble. Dame made 240. Harden that year was genuinely shooting from other zip codes.', playerA: harden, playerB: dame, valueA: 378, valueB: 240, unit: 'threes made', difficulty: 'medium' },
  { id: 'q_3pa_trae_dame', era: 'modern', category: 'three_point_pct', label: 'Three-Pointers Attempted', subLabel: '2021-22 regular season', flavor: 'Trae launched 874 threes and made 36% of them. Dame attempted 668. Volume shooting was the point guard meta.', playerA: trae, playerB: dame, valueA: 874, valueB: 668, unit: '3PA', difficulty: 'medium' },
  { id: 'q_3pct_klay_kd', era: 'modern', category: 'three_point_pct', label: '3-Point %', subLabel: '2018-19 regular season', flavor: 'Klay shot 40.2% from three while barely dribbling. Durant shot 35.4% — still great, but Klay was operating at a different efficiency level.', playerA: klay_gsw, playerB: kd_gsw, valueA: 402, valueB: 354, unit: '3P% x1000', difficulty: 'hard' },

  // ── FREE THROW VOLUME ─────────────────────────────────────────────────────
  { id: 'q_fta_harden_giannis', era: 'modern', category: 'missed_free_throws', label: 'Free Throws Attempted', subLabel: '2018-19 regular season', flavor: 'Harden attempted 1,028 free throws that season — the most in any season since Wilt. Giannis attempted 609, already elite.', playerA: harden, playerB: giannis2, valueA: 1028, valueB: 609, unit: 'FTA', difficulty: 'easy' },
  { id: 'q_ftm_dame_beal', era: 'modern', category: 'ft_pct', label: 'Free Throws Made', subLabel: '2020-21 regular season', flavor: 'Beal made 497 free throws at 84% — a high-volume, high-efficiency season. Dame made 418. Both lived at the line.', playerA: beal, playerB: dame, valueA: 497, valueB: 418, unit: 'FTM', difficulty: 'hard' },

  // ── REBOUNDS BREAKDOWN ────────────────────────────────────────────────────
  { id: 'q_oreb_whiteside_drummond', era: 'modern', category: 'offensive_rebounds', label: 'Offensive Rebounds', subLabel: '2015-16 regular season', flavor: 'Whiteside had 249 offensive boards in 73 games. Drummond had 299. Two rim-running centers who made second chances a living.', playerA: whiteside, playerB: drummond, valueA: 249, valueB: 299, unit: 'offensive rebounds', difficulty: 'medium' },
  { id: 'q_reb_ad_jokic', era: 'modern', category: 'offensive_rebounds', label: 'Total Rebounds', subLabel: '2020-21 regular season', flavor: 'AD grabbed 815 total boards, a career season. Jokic had 812 — they were literally one rebound apart.', playerA: ad, playerB: joker_mv3, valueA: 815, valueB: 812, unit: 'rebounds', difficulty: 'niche' },
  { id: 'q_reb_gobert_capela', era: 'modern', category: 'offensive_rebounds', label: 'Total Rebounds', subLabel: '2018-19 regular season', flavor: 'Gobert led the league with 1,054 rebounds. Capela had 803. Both protect the paint, but Gobert is in a different stratosphere.', playerA: gobert, playerB: capela, valueA: 1054, valueB: 803, unit: 'rebounds', difficulty: 'medium' },

  // ── ASSISTS VARIETY ───────────────────────────────────────────────────────
  { id: 'q_ast_harden_cp3', era: 'modern', category: 'assists', label: 'Season Assists', subLabel: '2018-19 regular season', flavor: 'Harden averaged 7.5 assists while scoring 36 per game. CP3 had 635 despite missing time. Both ran offenses differently.', playerA: harden, playerB: cp3, valueA: 619, valueB: 635, unit: 'assists', difficulty: 'hard' },
  { id: 'q_ast_trae_luka', era: 'modern', category: 'assists', label: 'Season Assists', subLabel: '2021-22 regular season', flavor: 'Trae had 737 assists — one of the highest totals for a 23-year-old ever. Luka had 490. Both run their offenses through their handle.', playerA: trae, playerB: luka_dal, valueA: 737, valueB: 490, unit: 'assists', difficulty: 'medium' },
  { id: 'q_ast_simmons_rubio', era: 'modern', category: 'assists', label: 'Season Assists', subLabel: '2019-20 regular season', flavor: 'Simmons had 671 assists as a non-shooter running Philly offense. Rubio had 491. Two pass-first guards from different eras of the position.', playerA: simmons, playerB: rubio, valueA: 671, valueB: 491, unit: 'assists', difficulty: 'hard' },

  // ── STEALS / BLOCKS ───────────────────────────────────────────────────────
  { id: 'q_stl_kawhi_pg', era: 'modern', category: 'steals', label: 'Season Steals', subLabel: '2018-19 regular season', flavor: 'Kawhi had 125 steals in Toronto. PG had 122 in OKC. Two of the best wing defenders in the league and they were almost identical.', playerA: kawhi, playerB: pg13, valueA: 125, valueB: 122, unit: 'steals', difficulty: 'niche' },
  { id: 'q_blk_whiteside_gobert', era: 'modern', category: 'blocks', label: 'Season Blocks', subLabel: '2015-16 regular season', flavor: 'Whiteside had 269 blocks — second-most since 2000. Gobert had 202. Whiteside was legitimately terrifying that year.', playerA: whiteside, playerB: gobert, valueA: 269, valueB: 202, unit: 'blocks', difficulty: 'medium' },

  // ── USAGE / VOLUME ────────────────────────────────────────────────────────
  { id: 'q_usage_harden_luka', era: 'modern', category: 'points', label: 'Usage Rate', subLabel: '2018-19 regular season (x100)', flavor: 'Harden had a 40.5% usage rate — the highest recorded in modern NBA history. Luka had 37.4% in 2022-23. One was a historical anomaly.', playerA: harden, playerB: luka_dal, valueA: 405, valueB: 374, unit: 'usage rate x100', difficulty: 'hard' },
  { id: 'q_min_lebron_durant', era: 'modern', category: 'games_played', label: 'Minutes Played', subLabel: '2012-13 regular season', flavor: 'LeBron played 2,877 minutes in the regular season. Durant played 3,119 — he almost never sat. Iron Man tendencies for both.', playerA: bron_heat, playerB: kd_gsw, valueA: 2877, valueB: 3119, unit: 'minutes', difficulty: 'hard' },

  // ── PLAYOFF SPECIFIC ──────────────────────────────────────────────────────
  { id: 'q_playoff_pts_bron_curry', era: 'modern', category: 'points', label: 'Playoff Points (run)', subLabel: '2015-16 playoffs', flavor: 'LeBron scored 571 points in the 2016 playoffs — all 21 games, 27.2 per. Curry had 576 in 21 games for the Warriors. Finals rematches do this.', playerA: bron_lbj, playerB: curry, valueA: 571, valueB: 576, unit: 'playoff pts', difficulty: 'hard' },
  { id: 'q_playoff_3pm_curry_klay', era: 'modern', category: 'three_point_pct', label: 'Playoff 3s Made', subLabel: '2018 playoffs', flavor: 'Curry made 98 threes in the 2018 playoffs — the most in any single postseason ever. Klay made 48. Same team. Different planet.', playerA: curry, playerB: klay_gsw, valueA: 98, valueB: 48, unit: 'playoff 3s', difficulty: 'easy' },

  // ── CAREER MILESTONES ─────────────────────────────────────────────────────
  { id: 'q_career_pts_kobe_dirk', era: 'classic', category: 'points', label: 'Career Points', subLabel: 'All-time career totals', flavor: 'Kobe retired with 33,643 career points — third all-time at the time. Dirk had 31,560. Two of the five greatest scorers in NBA history.', playerA: kobe06, playerB: melo, valueA: 33643, valueB: 28289, unit: 'career pts', difficulty: 'easy' },
  { id: 'q_career_3pm_curry_allen', era: 'modern', category: 'three_point_pct', label: 'Career 3-Pointers Made', subLabel: 'Through age-34 season', flavor: 'Curry passed Ray Allen at 2,974 threes and kept going. Allen retired with 2,973. Curry had 3,100+ by his mid-30s. Not close anymore.', playerA: curry, playerB: klay_gsw, valueA: 3100, valueB: 2019, unit: 'career 3s', difficulty: 'medium' },
  { id: 'q_career_ast_cp3_nash', era: 'modern', category: 'assists', label: 'Career Assists', subLabel: 'Career totals through 2022', flavor: 'CP3 surpassed Stockton on the all-time list with 12,000+ assists. Nash retired with 10,335. Point guard careers measured in decades.', playerA: cp3, playerB: rubio, valueA: 12000, valueB: 4641, unit: 'career ast', difficulty: 'easy' },

  // ── TURNOVERS AS ART ─────────────────────────────────────────────────────
  { id: 'q_tov_russ_harden2', era: 'modern', category: 'turnovers', label: 'Season Turnovers', subLabel: '2018-19 regular season', flavor: 'Harden had 464 turnovers running Houston by himself. Westbrook had 322 back in OKC. High usage, high chaos — different scales.', playerA: harden, playerB: westbrook, valueA: 464, valueB: 322, unit: 'turnovers', difficulty: 'medium' },
  { id: 'q_tov_trae_luka', era: 'modern', category: 'turnovers', label: 'Season Turnovers', subLabel: '2021-22 regular season', flavor: 'Trae had 345 turnovers running Atlanta. Luka had 346 in Dallas. One game apart. Both are ball-dominant point guards who accept this as the cost of creation.', playerA: trae, playerB: luka_dal, valueA: 345, valueB: 346, unit: 'turnovers', difficulty: 'niche' },

  // ── PERSONAL FOULS / TECHNICALS ──────────────────────────────────────────
  { id: 'q_pf_zion_giannis', era: 'modern', category: 'personal_fouls', label: 'Personal Fouls', subLabel: '2021-22 regular season', flavor: 'Zion fouled 201 times in his first real full season. Giannis had 198. Two athletic bigs who attack the paint without brakes.', playerA: zion, playerB: giannis2, valueA: 201, valueB: 198, unit: 'personal fouls', difficulty: 'niche' },
  { id: 'q_pf_vucevic_porzingis', era: 'modern', category: 'personal_fouls', label: 'Personal Fouls', subLabel: '2017-18 regular season', flavor: 'Porzingis fouled 233 times as the Knicks center. Vucevic had 185. Two European stretch-bigs learning to defend without fouling.', playerA: porzingis, playerB: vucevic, valueA: 233, valueB: 185, unit: 'personal fouls', difficulty: 'hard' },

  // ── COMBINED STAT LINES ───────────────────────────────────────────────────
  { id: 'q_pts_ast_schroder_cj', era: 'modern', category: 'assists', label: 'Points + Assists Combined', subLabel: '2019-20 regular season', flavor: 'Schroder combined for 1,422 points and assists as the OKC starter. McCollum had 1,689 in Portland. One was a borderline All-Star.', playerA: schroder, playerB: cj_mccol, valueA: 1422, valueB: 1689, unit: 'pts+ast', difficulty: 'hard' },
  { id: 'q_ingram_lavine_pts', era: 'modern', category: 'points', label: 'Season Points', subLabel: '2021-22 regular season', flavor: 'LaVine dropped 1,989 points in Chicago. Ingram had 1,774 in New Orleans. Two wing scorers who never got the national attention they deserved.', playerA: lavine, playerB: ingram, valueA: 1989, valueB: 1774, unit: 'total points', difficulty: 'medium' },

];


export function getQuestionsByDifficulty(difficulty: 'easy' | 'medium' | 'hard' | 'niche'): Question[] {
  return QUESTIONS.filter(q => q.difficulty === difficulty);
}

export function getDailyQuestions(era: Era | 'all' = 'all', count = 10): Question[] {
  const today = new Date().toISOString().split('T')[0];
  const base = QUESTIONS.filter(q => era === 'all' || q.era === era);
  const sorted = [...base].sort((a, b) => hashCode(a.id + today) - hashCode(b.id + today));
  return sorted.slice(0, count);
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
