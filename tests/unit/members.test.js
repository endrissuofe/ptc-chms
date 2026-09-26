import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  mapHeaders,
  splitName,
  parseGender,
  parseBirthday,
  readMemberCsv,
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
    expect(mapHeaders(['BIRTHDAY', 'Phone Number', 'Full Name', 'Sex'])).toEqual({
      name: 2,
      phone: 1,
      gender: 3,
      birthday: 0,
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
