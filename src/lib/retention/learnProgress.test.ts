import { describe, expect, it } from 'vitest';
import { mostRecentlyVisitedPath, nextLessonForPath, pathProgress } from './learnProgress';

const lessons = [
  { slug: 'one', title: 'One', href: '/learn/path/one/' },
  { slug: 'two', title: 'Two', href: '/learn/path/two/' },
  { slug: 'three', title: 'Three', href: '/learn/path/three/' },
];

describe('learning progress', () => {
  it('counts only lessons that still belong to the path', () => {
    expect(pathProgress({ completedLessons: ['one', 'deleted'] }, lessons)).toEqual({
      completedCount: 1,
      totalCount: 3,
      percentage: 33,
      complete: false,
    });
  });

  it('continues an unfinished last visit, then selects the next incomplete lesson', () => {
    expect(
      nextLessonForPath(
        {
          completedLessons: ['one'],
          lastVisitedLesson: 'two',
          lastVisitedAt: '2026-08-21T14:00:00.000Z',
        },
        lessons,
      ),
    ).toMatchObject({ lesson: lessons[1], reason: 'last-visited' });

    expect(
      nextLessonForPath(
        {
          completedLessons: ['one', 'two'],
          lastVisitedLesson: 'two',
          lastVisitedAt: '2026-08-21T14:00:00.000Z',
        },
        lessons,
      ),
    ).toMatchObject({ lesson: lessons[2], reason: 'next-incomplete' });
  });

  it('switches to review when a path is complete', () => {
    expect(
      nextLessonForPath(
        {
          completedLessons: ['one', 'two', 'three'],
          lastVisitedLesson: 'three',
          lastVisitedAt: '2026-08-21T14:00:00.000Z',
        },
        lessons,
      ),
    ).toMatchObject({ lesson: lessons[2], reason: 'review', complete: true });
  });

  it('finds the path visited most recently', () => {
    const state = {
      version: 1 as const,
      paths: {
        first: {
          completedLessons: [],
          lastVisitedLesson: 'one',
          lastVisitedAt: '2026-08-21T14:00:00.000Z',
        },
        second: {
          completedLessons: [],
          lastVisitedLesson: 'two',
          lastVisitedAt: '2026-08-21T14:01:00.000Z',
        },
      },
    };
    expect(
      mostRecentlyVisitedPath(state, [
        { slug: 'first', lessons },
        { slug: 'second', lessons },
      ]),
    ).toMatchObject({ pathSlug: 'second', result: { lesson: lessons[1] } });
  });
});
