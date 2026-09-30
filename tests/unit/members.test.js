import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  mapHeaders,
  splitName,
  parseGender,
  parseBirthday,
  readMemberCsv,
  nameKey,
  planMemberMerge,
  sameNameReason,
  possibleDuplicates,
} from '@/lib/members';

describe('parseCsv', () => {
  it('reads commas, quotes, semicolons and Excel’s BOM', () => {
    expect(parseCsv('﻿Name,Phone\n"Okafor, Chinedu",0803 000 0001\r\n')).toEqual([
      ['Name', 'Phone'],
      ['Okafor, Chinedu', '0803 000 0001'],
    ]);
    expect(parseCsv('Name;Phone\nAda;0803\n\n')).toEqual([
      ['Name', 'Phone'],
      ['Ada', '0803'],
    ]);
    expect(parseCsv('a,"say ""hi"""')).toEqual([['a', 'say "hi"']]);
  });
});

describe('member columns and values', () => {
  it('finds columns whatever their order or capitals', () => {
    expect(
      mapHeaders(['BIRTHDAY', 'Phone Number', 'Full Name', 'Sex', 'Wedding Anniversary']),
    ).toEqual({
      name: 2,
      phone: 1,
      gender: 3,
      birthday: 0,
      anniversary: 4,
      address: -1,
    });
  });

  it('reads the church sheet’s own headings, with the address', () => {
    const [row] = readMemberCsv(
      'NAMES,PHONE NUMBERS,HOME ADDRESS,DATE OF BIRTHDAY\nAda Eze,8030000001,"12  Adeola St,  Ikeja",14 Oct',
    );
    expect(row).toMatchObject({
      firstName: 'Ada',
      phone: '+2348030000001',
      address: '12 Adeola St, Ikeja',
      birthDay: 14,
      birthMonth: 10,
    });
  });

  it('splits names and drops titles', () => {
    expect(splitName('Bro. Chinedu  Okafor')).toEqual({ firstName: 'Chinedu', lastName: 'Okafor' });
    expect(splitName('Mrs Grace Ada Amadi')).toEqual({ firstName: 'Grace', lastName: 'Ada Amadi' });
    expect(splitName('Kemi')).toEqual({ firstName: 'Kemi', lastName: '' });
  });

  it('reads gender', () => {
    expect(parseGender('M')).toBe('male');
    expect(parseGender('Female')).toBe('female');
    expect(parseGender('')).toBeUndefined();
  });

  it('reads birthdays day first, in words or numbers', () => {
    expect(parseBirthday('14/10')).toEqual({ birthDay: 14, birthMonth: 10 });
    expect(parseBirthday('14-10-1990')).toEqual({ birthDay: 14, birthMonth: 10 });
    expect(parseBirthday('1990-10-14')).toEqual({ birthDay: 14, birthMonth: 10 });
    expect(parseBirthday('14 Oct')).toEqual({ birthDay: 14, birthMonth: 10 });
    expect(parseBirthday('14th October 1990')).toEqual({ birthDay: 14, birthMonth: 10 });
    expect(parseBirthday('October 14')).toEqual({ birthDay: 14, birthMonth: 10 });
    expect(parseBirthday('31/04')).toEqual({});
    expect(parseBirthday('someday')).toEqual({});
  });
});

describe('readMemberCsv', () => {
  it('turns rows into members and lists what is wrong with each', () => {
    const rows = readMemberCsv(
      'Name,Phone,Gender,Birthday\nChinedu Okafor,0803 000 0001,M,14/10\n,0803 000 0002,F,\nAda Obi,12345,F,sometime\n',
    );
    expect(rows[0]).toMatchObject({
      line: 2,
      firstName: 'Chinedu',
      lastName: 'Okafor',
      phone: '+2348030000001',
      gender: 'male',
      birthDay: 14,
      birthMonth: 10,
      problems: [],
    });
    expect(rows[1].problems).toEqual(['No name']);
    expect(rows[2].problems).toEqual(['Phone number not valid']);
    expect(rows[2].birthdayUnread).toBe(true);
  });

  it('explains a file without Name and Phone columns', () => {
    expect(() => readMemberCsv('First,Last\nA,B\n')).toThrow(/Name and Phone/);
  });
});

describe('planMemberMerge', () => {
  const members = [
    { _id: 'm1', firstName: 'Chinedu', lastName: 'Okafor', phone: '+2348030000001' },
    {
      _id: 'm2',
      firstName: 'Bola',
      lastName: 'Ade',
      phone: '+2348030000002',
      birthDay: 3,
      birthMonth: 5,
    },
    { _id: 'm3', firstName: 'Ada', lastName: 'Eze', phone: '+2348030000003' },
    { _id: 'm4', firstName: 'Ada', lastName: 'Eze', phone: '+2348030000004' },
  ];
  const csv = (body) => readMemberCsv(`Name,Phone,Birthday,Anniversary\n${body}`);

  it('matches names in any word order and case', () => {
    expect(nameKey('Okafor', 'Chinedu')).toBe(nameKey('chinedu', ' OKAFOR '));
  });

  it('fills a missing birthday by phone and name, never overwriting one', () => {
    const plan = planMemberMerge(
      csv('Okafor Chinedu,08030000001,14/10\nBola Ade,08030000002,1/1\n'),
      members,
    );
    expect(plan.fill).toEqual([
      { memberId: 'm1', lines: [2], how: 'phone', set: { birthDay: 14, birthMonth: 10 } },
    ]);
    expect(plan.already).toEqual([3]);
    expect(plan.add).toEqual([]);
  });

  it('fills by name alone only when exactly one member has that name', () => {
    const plan = planMemberMerge(
      csv('Bro. Chinedu Okafor,,14 Oct,2 Feb\nAda Eze,,1/1\nNew Person,,1/1\n'),
      members,
    );
    expect(plan.fill).toEqual([
      {
        memberId: 'm1',
        lines: [2],
        how: 'name',
        set: { birthDay: 14, birthMonth: 10, anniversaryDay: 2, anniversaryMonth: 2 },
      },
    ]);
    expect(plan.sameName).toEqual([3]);
    expect(plan.notFound).toEqual([4]);
  });

  it('adds new people with a phone once, and holds back a known name on another phone', () => {
    const plan = planMemberMerge(
      csv('Tunde Bello,08030000009,\nTunde Bello,08030000009,\nChinedu Okafor,08030000099,\n'),
      members,
    );
    expect(plan.add.map((r) => r.line)).toEqual([2]);
    expect(plan.repeated).toEqual([3]);
    expect(plan.otherPhone).toEqual([4]);
  });

  it('matches a name with a middle name more or less, only when that points to one member', () => {
    const plan = planMemberMerge(
      csv('Chinedu Paul Okafor,,14/10\nAda,,1/1\nAda Grace Eze,,1/1\n'),
      members,
    );
    expect(plan.fill.map((f) => f.memberId)).toEqual(['m1']);
    expect(plan.notFound).toEqual([3]);
    expect(plan.sameName).toEqual([4]);
  });

  it('treats people added from earlier rows as known', () => {
    const plan = planMemberMerge(
      csv('Tunde Bello,08030000009,\nBello Tunde,,5 May\nTunde Bello,08030000008,\n'),
      members,
    );
    expect(plan.add).toHaveLength(1);
    expect(plan.add[0]).toMatchObject({ line: 2, birthDay: 5, birthMonth: 5 });
    expect(plan.repeated).toEqual([3]);
    expect(plan.otherPhone).toEqual([4]);
    expect(plan.fill).toEqual([]);
  });

  it('merges two rows for the same member without the second overwriting the first', () => {
    const plan = planMemberMerge(
      csv('Chinedu Okafor,08030000001,14/10\nChinedu Okafor,,20/12,2/2\n'),
      members,
    );
    expect(plan.fill).toEqual([
      {
        memberId: 'm1',
        lines: [2, 3],
        how: 'phone',
        set: { birthDay: 14, birthMonth: 10, anniversaryDay: 2, anniversaryMonth: 2 },
      },
    ]);
  });
});

describe('possible duplicates', () => {
  const m = (id, firstName, lastName, extra = {}) => ({
    _id: id,
    firstName,
    lastName,
    phone: '+2348030000001',
    ...extra,
  });

  it('spots one person entered twice, but not a family on one phone', () => {
    expect(sameNameReason(m(1, 'Chinedu', 'Okafor'), m(2, 'Okafor', 'Chinedu'))).toBe('Same name');
    expect(sameNameReason(m(1, 'Chinedu', 'Okafor'), m(2, 'Chinedo', 'Okafor'))).toBe(
      'Spelled differently',
    );
    expect(sameNameReason(m(1, 'Bola', 'Ade'), m(2, 'Bolanle', 'Ade'))).toBe('Spelled differently');
    expect(sameNameReason(m(1, 'Ada', 'Eze'), m(2, 'Ada Grace', 'Eze'))).toBe(
      'Middle name more or less',
    );
    expect(sameNameReason(m(1, 'Ada', ''), m(2, 'Ada', 'Eze'))).toBe('One has only one name');
    expect(sameNameReason(m(1, 'Ada', 'Eze'), m(2, 'Chuka', 'Eze'))).toBeNull();
    expect(sameNameReason(m(1, 'Chioma', 'Eze'), m(2, 'Chinedu', 'Eze'))).toBeNull();
  });

  it('pairs look-alikes by phone and leaves out pairs marked as different people', () => {
    const groups = possibleDuplicates([
      m('a', 'Chinedu', 'Okafor'),
      m('b', 'Chinedo', 'Okafor'),
      m('c', 'Ngozi', 'Okafor'),
      m('d', 'Chinedu', 'Okafor', { phone: '+2348030000002' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].pairs.map((p) => [p.a._id, p.b._id])).toEqual([['a', 'b']]);

    expect(
      possibleDuplicates([
        m('a', 'Chinedu', 'Okafor', { notDuplicates: ['b'] }),
        m('b', 'Chinedo', 'Okafor'),
      ]),
    ).toEqual([]);
  });
});
