/**
 * A verse for each day on the Today screen. King James Version (public domain).
 * The same verse shows all day for everyone; it moves on at midnight Lagos time.
 */
export const VERSES = [
  [
    'For where two or three are gathered together in my name, there am I in the midst of them.',
    'Matthew 18:20',
  ],
  ['I was glad when they said unto me, Let us go into the house of the Lord.', 'Psalm 122:1'],
  ['This is the day which the Lord hath made; we will rejoice and be glad in it.', 'Psalm 118:24'],
  ['Serve the Lord with gladness: come before his presence with singing.', 'Psalm 100:2'],
  [
    'Be not forgetful to entertain strangers: for thereby some have entertained angels unawares.',
    'Hebrews 13:2',
  ],
  [
    'Wherefore receive ye one another, as Christ also received us to the glory of God.',
    'Romans 15:7',
  ],
  ['The Lord is my shepherd; I shall not want.', 'Psalm 23:1'],
  [
    'Trust in the Lord with all thine heart; and lean not unto thine own understanding.',
    'Proverbs 3:5',
  ],
  ['I can do all things through Christ which strengtheneth me.', 'Philippians 4:13'],
  [
    'Come unto me, all ye that labour and are heavy laden, and I will give you rest.',
    'Matthew 11:28',
  ],
  ['Let brotherly love continue.', 'Hebrews 13:1'],
  ['And let us consider one another to provoke unto love and to good works.', 'Hebrews 10:24'],
  [
    'Not forsaking the assembling of ourselves together, as the manner of some is.',
    'Hebrews 10:25',
  ],
  ['Bear ye one another’s burdens, and so fulfil the law of Christ.', 'Galatians 6:2'],
  [
    'Behold, how good and how pleasant it is for brethren to dwell together in unity!',
    'Psalm 133:1',
  ],
  ['Whatsoever ye do, do it heartily, as to the Lord, and not unto men.', 'Colossians 3:23'],
  ['Let your light so shine before men, that they may see your good works.', 'Matthew 5:16'],
  ['The Lord bless thee, and keep thee.', 'Numbers 6:24'],
  ['Be strong and of a good courage; be not afraid, neither be thou dismayed.', 'Joshua 1:9'],
  ['They that wait upon the Lord shall renew their strength.', 'Isaiah 40:31'],
  ['Cast thy burden upon the Lord, and he shall sustain thee.', 'Psalm 55:22'],
  ['In all thy ways acknowledge him, and he shall direct thy paths.', 'Proverbs 3:6'],
  ['O give thanks unto the Lord; for he is good: for his mercy endureth for ever.', 'Psalm 136:1'],
  ['A new commandment I give unto you, That ye love one another.', 'John 13:34'],
  [
    'By this shall all men know that ye are my disciples, if ye have love one to another.',
    'John 13:35',
  ],
  ['Freely ye have received, freely give.', 'Matthew 10:8'],
  ['Rejoice in the Lord alway: and again I say, Rejoice.', 'Philippians 4:4'],
  ['Pray without ceasing.', '1 Thessalonians 5:17'],
  [
    'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.',
    '1 Thessalonians 5:18',
  ],
  ['The joy of the Lord is your strength.', 'Nehemiah 8:10'],
  ['God is our refuge and strength, a very present help in trouble.', 'Psalm 46:1'],
  ['Thy word is a lamp unto my feet, and a light unto my path.', 'Psalm 119:105'],
  ['Him that cometh to me I will in no wise cast out.', 'John 6:37'],
  ['Every good gift and every perfect gift is from above.', 'James 1:17'],
  ['Let all things be done decently and in order.', '1 Corinthians 14:40'],
  [
    'Be kindly affectioned one to another with brotherly love; in honour preferring one another.',
    'Romans 12:10',
  ],
  ['Now ye are the body of Christ, and members in particular.', '1 Corinthians 12:27'],
  ['Go ye therefore, and teach all nations.', 'Matthew 28:19'],
  ['The harvest truly is plenteous, but the labourers are few.', 'Matthew 9:37'],
  ['He that winneth souls is wise.', 'Proverbs 11:30'],
  ['Let every thing that hath breath praise the Lord.', 'Psalm 150:6'],
  ['Great is thy faithfulness.', 'Lamentations 3:23'],
  ['The Lord is nigh unto all them that call upon him.', 'Psalm 145:18'],
  ['Draw nigh to God, and he will draw nigh to you.', 'James 4:8'],
  ['Be ye kind one to another, tenderhearted, forgiving one another.', 'Ephesians 4:32'],
  ['Walk in love, as Christ also hath loved us.', 'Ephesians 5:2'],
  ['Peace I leave with you, my peace I give unto you.', 'John 14:27'],
  ['Seek ye first the kingdom of God, and his righteousness.', 'Matthew 6:33'],
  ['Ask, and it shall be given you; seek, and ye shall find.', 'Matthew 7:7'],
  ['The steps of a good man are ordered by the Lord.', 'Psalm 37:23'],
  ['Commit thy works unto the Lord, and thy thoughts shall be established.', 'Proverbs 16:3'],
  ['Behold, I stand at the door, and knock.', 'Revelation 3:20'],
  ['Whosoever shall call upon the name of the Lord shall be saved.', 'Romans 10:13'],
  ['The Lord shall preserve thy going out and thy coming in.', 'Psalm 121:8'],
  ['Unto whomsoever much is given, of him shall be much required.', 'Luke 12:48'],
  [
    'Let us not be weary in well doing: for in due season we shall reap, if we faint not.',
    'Galatians 6:9',
  ],
  [
    'As every man hath received the gift, even so minister the same one to another.',
    '1 Peter 4:10',
  ],
  ['Love suffereth long, and is kind.', '1 Corinthians 13:4'],
  ['Blessed are the peacemakers: for they shall be called the children of God.', 'Matthew 5:9'],
  ['Be still, and know that I am God.', 'Psalm 46:10'],
];

/** Days since 1 Jan 1970 in Lagos, so the verse changes at local midnight. */
function lagosDayNumber(date) {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(date);
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);
}

export function verseOfTheDay(date = new Date()) {
  const [text, reference] = VERSES[lagosDayNumber(date) % VERSES.length];
  return { text, reference };
}
